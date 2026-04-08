import * as os from 'os';
import { HostInfo } from '../types';

export function getHostInfo(): HostInfo {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    type: os.type(),
    version: os.version(),
    arch: os.arch(),
  };
}
