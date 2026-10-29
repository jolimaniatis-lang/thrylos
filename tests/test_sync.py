#!/usr/bin/env python3
"""Δοκιμές του tools/sync.py σε απομονωμένα προσωρινά repos (τοπικό "remote"). Δεν αγγίζει το πραγματικό repo/GitHub.
Τρέξιμο: python3 tests/test_sync.py"""
import json, os, shutil, subprocess, sys, tempfile, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = dict(os.environ, GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t", GIT_COMMITTER_EMAIL="t@t", PYTHONDONTWRITEBYTECODE="1")

def git(cwd, *a, check=True):
    r = subprocess.run(["git", "-C", cwd, *a], capture_output=True, text=True, env=ENV)
    if check and r.returncode: raise RuntimeError(r.stderr)
    return r.stdout.strip()

def wj(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f: json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))

def rd(path):
    with open(path, encoding="utf8") as f: return f.read()

def wt(path, text):
    with open(path, "w") as f: f.write(text)

class SyncTest(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.mkdtemp(); self.remote = self.t + "/remote.git"; self.seed = self.t + "/seed"; self.work = self.t + "/work"; self.exp = self.t + "/exp"
        subprocess.run(["git", "init", "-q", "--bare", "-b", "main", self.remote], check=True)
        os.makedirs(self.seed + "/tools"); subprocess.run(["git", "init", "-q", "-b", "main", self.seed], check=True)
        for f in ("sync.py", "validate_data.py"): shutil.copy(ROOT + "/tools/" + f, self.seed + "/tools/" + f)
        wt(self.seed + "/index.html", "v1")
        wj(self.seed + "/data/live/now.json", {"matches": [], "updatedAt": "old"})
        eds = ["2026-10-29", "2026-10-28", "2026-10-27"]
        for e in eds: wj(self.seed + "/data/editions/%s.json" % e, {"date": e, "items": []})
        wj(self.seed + "/data/index.json", {"editions": eds, "rosters": []})
        git(self.seed, "add", "-A"); git(self.seed, "commit", "-qm", "seed"); git(self.seed, "remote", "add", "origin", self.remote); git(self.seed, "push", "-q", "origin", "main")
        subprocess.run(["git", "clone", "-q", "--depth", "1", "file://" + self.remote, self.work], check=True, env=ENV)  # όπως ο scheduled task
        wj(self.exp + "/live/now.json", {"matches": [], "updatedAt": "new"})
    def tearDown(self): shutil.rmtree(self.t, ignore_errors=True)
    def run_sync(self, *args, cwd=None):
        return subprocess.run([sys.executable, (cwd or self.work) + "/tools/sync.py", *args], capture_output=True, text=True, env=ENV)
    def remote_head(self): return git(self.remote, "rev-parse", "main")
    def files_of(self, rev): return git(self.remote, "show", "--name-only", "--format=", rev).split()

    def test_main_pushes_data_only(self):
        r = self.run_sync(self.exp, "live"); self.assertEqual(r.returncode, 0, r.stdout + r.stderr); self.assertIn("push OK", r.stdout)
        self.assertEqual(self.files_of("main"), ["data/live/now.json"])
    def test_staged_extra_file_not_committed(self):
        wt(self.work + "/extra.txt", "x"); git(self.work, "add", "extra.txt")
        r = self.run_sync(self.exp, "live"); self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.files_of("main"), ["data/live/now.json"]); self.assertIn("extra.txt", git(self.work, "diff", "--cached", "--name-only"))
    def test_other_branch_refused(self):
        git(self.work, "checkout", "-q", "-b", "ui-test"); before = self.remote_head()
        r = self.run_sync(self.exp, "live"); self.assertEqual(r.returncode, 2); self.assertEqual(self.remote_head(), before)
        self.assertIn('"old"', rd(self.work + "/data/live/now.json"))  # δεν γράφτηκε τίποτα
    def test_detached_head_refused(self):
        git(self.work, "checkout", "-q", "--detach"); before = self.remote_head()
        r = self.run_sync(self.exp, "live"); self.assertEqual(r.returncode, 2); self.assertEqual(self.remote_head(), before)
    def test_dry_run_allowed_on_any_branch(self):
        git(self.work, "checkout", "-q", "-b", "ui-test"); r = self.run_sync("--dry-run", self.exp, "live"); self.assertEqual(r.returncode, 0, r.stdout); self.assertIn('"old"', rd(self.work + "/data/live/now.json"))
    def test_local_non_data_commit_blocks_push(self):
        wt(self.work + "/index.html", "v2-ui"); git(self.work, "commit", "-qam", "ui change"); before = self.remote_head()
        r = self.run_sync(self.exp, "live"); self.assertEqual(r.returncode, 3, r.stdout + r.stderr); self.assertIn("index.html", r.stdout); self.assertEqual(self.remote_head(), before)
    def test_retry_after_concurrent_push(self):
        other = self.t + "/other"; subprocess.run(["git", "clone", "-q", "file://" + self.remote, other], check=True, env=ENV)
        wj(other + "/data/schedule/season.json", {"matches": [], "updatedAt": "z"}); git(other, "add", "-A"); git(other, "commit", "-qm", "other data"); git(other, "push", "-q", "origin", "main")
        r = self.run_sync(self.exp, "live"); self.assertEqual(r.returncode, 0, r.stdout + r.stderr); self.assertIn("push OK", r.stdout)
        log = git(self.remote, "log", "--format=%s", "-3"); self.assertIn("other data", log); self.assertIn("data ", log.splitlines()[0])
        self.assertEqual(self.files_of("main"), ["data/live/now.json"])
    def test_prune_old_editions_is_committed(self):
        for i in range(62): wj(self.exp + "/editions/2026-11-%02d-%02d.json" % (i // 28 + 1, i % 28 + 1), {"date": "n", "items": []})
        r = self.run_sync(self.exp, "editions"); self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        files = self.files_of("main"); self.assertTrue(all(f.startswith("data/") for f in files)); self.assertIn("data/index.json", files)
        self.assertEqual(len(git(self.remote, "ls-tree", "-r", "--name-only", "main", "data/editions").split()), 60)
    def test_invalid_and_empty_json_skipped(self):
        wt(self.exp + "/live/bad.json", "{bad"); wj(self.exp + "/live/empty.json", {})
        r = self.run_sync(self.exp, "live"); self.assertEqual(r.returncode, 0, r.stdout + r.stderr); self.assertEqual(self.files_of("main"), ["data/live/now.json"])

if __name__ == "__main__": unittest.main(verbosity=2)
