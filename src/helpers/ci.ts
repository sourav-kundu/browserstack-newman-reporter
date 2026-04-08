import { CiInfo } from '../types';

function isSet(val: string | undefined): boolean {
  return typeof val === 'string' && val.length > 0;
}

function isTrue(val: string | undefined): boolean {
  return val === 'true' || val === 'True' || val === 'TRUE' || val === '1';
}

export function getCiInfo(): CiInfo {
  const env = process.env;

  // Jenkins
  if (isSet(env.JENKINS_URL) || isSet(env.JENKINS_HOME)) {
    return { name: 'Jenkins', build_url: env.BUILD_URL ?? null, job_name: env.JOB_NAME ?? null, build_number: env.BUILD_NUMBER ?? null };
  }
  // CircleCI
  if (isTrue(env.CI) && isTrue(env.CIRCLECI)) {
    return { name: 'CircleCI', build_url: env.CIRCLE_BUILD_URL ?? null, job_name: env.CIRCLE_JOB ?? null, build_number: env.CIRCLE_BUILD_NUM ?? null };
  }
  // Travis CI
  if (isTrue(env.CI) && isTrue(env.TRAVIS)) {
    return { name: 'Travis CI', build_url: env.TRAVIS_BUILD_WEB_URL ?? null, job_name: env.TRAVIS_JOB_NAME ?? null, build_number: env.TRAVIS_BUILD_NUMBER ?? null };
  }
  // Codeship
  if (isTrue(env.CI) && isTrue(env.CI_NAME)) {
    return { name: 'Codeship', build_url: null, job_name: null, build_number: null };
  }
  // Bitbucket
  if (isSet(env.BITBUCKET_BRANCH) && isSet(env.BITBUCKET_COMMIT)) {
    return { name: 'Bitbucket', build_url: env.BITBUCKET_GIT_HTTP_ORIGIN ?? null, job_name: null, build_number: env.BITBUCKET_BUILD_NUMBER ?? null };
  }
  // Drone
  if (isTrue(env.CI) && isTrue(env.DRONE)) {
    return { name: 'Drone', build_url: env.DRONE_BUILD_LINK ?? null, job_name: null, build_number: env.DRONE_BUILD_NUMBER ?? null };
  }
  // Semaphore
  if (isTrue(env.CI) && isTrue(env.SEMAPHORE)) {
    return { name: 'Semaphore', build_url: env.SEMAPHORE_ORGANIZATION_URL ?? null, job_name: env.SEMAPHORE_JOB_NAME ?? null, build_number: env.SEMAPHORE_JOB_ID ?? null };
  }
  // GitLab
  if (isTrue(env.CI) && isTrue(env.GITLAB_CI)) {
    return { name: 'GitLab', build_url: env.CI_JOB_URL ?? null, job_name: env.CI_JOB_NAME ?? null, build_number: env.CI_JOB_ID ?? null };
  }
  // Buildkite
  if (isTrue(env.CI) && isTrue(env.BUILDKITE)) {
    return { name: 'Buildkite', build_url: env.BUILDKITE_BUILD_URL ?? null, job_name: env.BUILDKITE_LABEL ?? env.BUILDKITE_PIPELINE_NAME ?? null, build_number: env.BUILDKITE_BUILD_NUMBER ?? null };
  }
  // Azure Pipelines
  if (isSet(env.AZURE_HTTP_USER_AGENT) && isTrue(env.TF_BUILD)) {
    return { name: 'Azure Pipelines', build_url: null, job_name: env.BUILD_BUILDID ?? null, build_number: env.BUILD_BUILDID ?? null };
  }
  // Visual Studio Team Services
  if (isTrue(env.TF_BUILD)) {
    const serverUri = env.SYSTEM_TEAMFOUNDATIONSERVERURI ?? '';
    const projectId = env.SYSTEM_TEAMPROJECTID ?? '';
    return { name: 'Visual Studio Team Services', build_url: serverUri && projectId ? `${serverUri}${projectId}` : null, job_name: env.SYSTEM_DEFINITIONID ?? null, build_number: env.BUILD_BUILDID ?? null };
  }
  // Appveyor
  if (isTrue(env.APPVEYOR)) {
    const url = env.APPVEYOR_URL && env.APPVEYOR_ACCOUNT_NAME && env.APPVEYOR_PROJECT_SLUG && env.APPVEYOR_BUILD_VERSION
      ? `${env.APPVEYOR_URL}/project/${env.APPVEYOR_ACCOUNT_NAME}/${env.APPVEYOR_PROJECT_SLUG}/build/${env.APPVEYOR_BUILD_VERSION}`
      : null;
    return { name: 'Appveyor', build_url: url, job_name: env.APPVEYOR_JOB_NAME ?? null, build_number: env.APPVEYOR_BUILD_NUMBER ?? null };
  }
  // AWS CodeBuild
  if (isSet(env.CODEBUILD_BUILD_ID) || isSet(env.CODEBUILD_RESOLVED_SOURCE_VERSION) || isSet(env.CODEBUILD_SOURCE_VERSION)) {
    return { name: 'AWS CodeBuild', build_url: env.CODEBUILD_PUBLIC_BUILD_URL ?? null, job_name: env.CODEBUILD_BUILD_ID ?? null, build_number: env.CODEBUILD_BUILD_ID ?? null };
  }
  // Bamboo
  if (isSet(env.bamboo_buildNumber)) {
    return { name: 'Bamboo', build_url: env.bamboo_buildResultsUrl ?? null, job_name: env.bamboo_shortJobName ?? null, build_number: env.bamboo_buildNumber ?? null };
  }
  // Wercker
  if (isSet(env.WERCKER) || isSet(env.WERCKER_MAIN_PIPELINE_STARTED)) {
    return { name: 'Wercker', build_url: env.WERCKER_BUILD_URL ?? null, job_name: env.WERCKER_MAIN_PIPELINE_STARTED ? 'Main Pipeline' : null, build_number: env.WERCKER_GIT_COMMIT ?? null };
  }
  // Google Cloud
  if (isSet(env.GCP_PROJECT) || isSet(env.GCLOUD_PROJECT) || isSet(env.GOOGLE_CLOUD_PROJECT)) {
    return { name: 'Google Cloud', build_url: null, job_name: env.PROJECT_ID ?? null, build_number: env.BUILD_ID ?? null };
  }
  // Shippable
  if (isTrue(env.SHIPPABLE)) {
    return { name: 'Shippable', build_url: env.SHIPPABLE_BUILD_URL ?? null, job_name: env.SHIPPABLE_JOB_ID ? `Job #${env.SHIPPABLE_JOB_ID}` : null, build_number: env.SHIPPABLE_BUILD_NUMBER ?? null };
  }
  // Netlify
  if (isTrue(env.NETLIFY)) {
    return { name: 'Netlify', build_url: env.DEPLOY_URL ?? null, job_name: env.SITE_NAME ?? null, build_number: env.BUILD_ID ?? null };
  }
  // GitHub Actions
  if (isTrue(env.GITHUB_ACTIONS)) {
    const buildUrl = env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
      : null;
    return { name: 'GitHub Actions', build_url: buildUrl, job_name: env.GITHUB_WORKFLOW ?? null, build_number: env.GITHUB_RUN_ID ?? null };
  }
  // Vercel
  if (isTrue(env.CI) && env.VERCEL === '1') {
    return { name: 'Vercel', build_url: env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null, job_name: null, build_number: env.VERCEL_GITHUB_DEPLOYMENT ?? null };
  }
  // Teamcity
  if (isSet(env.TEAMCITY_VERSION)) {
    return { name: 'Teamcity', build_url: null, job_name: null, build_number: env.BUILD_NUMBER ?? null };
  }
  // Concourse
  if (isSet(env.CONCOURSE) || isSet(env.CONCOURSE_URL) || isSet(env.CONCOURSE_USERNAME) || isSet(env.CONCOURSE_TEAM)) {
    return { name: 'Concourse', build_url: null, job_name: env.BUILD_JOB_NAME ?? null, build_number: env.BUILD_ID ?? null };
  }
  // GoCD
  if (isSet(env.GO_JOB_NAME)) {
    return { name: 'GoCD', build_url: null, job_name: env.GO_JOB_NAME ?? null, build_number: env.GO_PIPELINE_COUNTER ?? null };
  }
  // CodeFresh
  if (isSet(env.CF_BUILD_ID)) {
    return { name: 'CodeFresh', build_url: env.CF_BUILD_URL ?? null, job_name: env.CF_PIPELINE_NAME ?? null, build_number: env.CF_BUILD_ID ?? null };
  }

  return { build_number: null };
}
