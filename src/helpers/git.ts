import { GitMetaData } from '../types';
import { debug } from './logger';

const MAX_GIT_META_DATA_SIZE = 64 * 1024; // 64KB

export async function getGitMetaData(): Promise<GitMetaData | Record<string, never>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const getRepoInfo = require('git-repo-info');
    const info = getRepoInfo();

    if (!info.commonGitDir) {
      debug('Unable to find a Git directory');
      return {};
    }

    const gitMetaData: GitMetaData = {
      name: 'git',
      sha: info.sha ?? null,
      short_sha: info.abbreviatedSha ?? null,
      branch: info.branch ?? null,
      tag: info.tag ?? null,
      committer: info.committer ?? null,
      committer_date: info.committerDate ?? null,
      author: info.author ?? null,
      author_date: info.authorDate ?? null,
      commit_message: info.commitMessage ?? null,
      root: info.root ?? null,
      common_git_dir: info.commonGitDir ?? null,
      worktree_git_dir: info.worktreeGitDir ?? null,
      last_tag: info.lastTag ?? null,
      commits_since_last_tag: info.commitsSinceLastTag ?? null,
      remotes: [],
    };

    // Try to get remotes from git config
    try {
      const gitconfiglocal = require('gitconfiglocal');
      const pGitconfig = (dir: string): Promise<{ remote?: Record<string, { url?: string }> }> =>
        new Promise((resolve, reject) => {
          gitconfiglocal(dir, (err: Error | null, config: Record<string, unknown>) => {
            if (err) reject(err);
            else resolve(config as { remote?: Record<string, { url?: string }> });
          });
        });

      const config = await pGitconfig(info.commonGitDir);
      if (config.remote) {
        gitMetaData.remotes = Object.entries(config.remote).map(([name, remote]) => ({
          name,
          url: remote.url ?? '',
        }));
      }
    } catch (e) {
      debug(`Unable to read git remotes: ${e}`);
    }

    // Truncate commit_message if payload is too large
    const size = Buffer.byteLength(JSON.stringify(gitMetaData), 'utf8');
    if (size > MAX_GIT_META_DATA_SIZE && gitMetaData.commit_message) {
      const overflow = size - MAX_GIT_META_DATA_SIZE;
      gitMetaData.commit_message =
        gitMetaData.commit_message.slice(0, -(overflow + 15)) + '...[TRUNCATED]';
    }

    return gitMetaData;
  } catch (e) {
    debug(`Unable to get git metadata: ${e}`);
    return {};
  }
}
