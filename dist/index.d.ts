import { Plugin } from 'vite';

interface Options {
    allowlist?: string[];
    envFiles?: string[];
    envVar?: string;
    allowLocalhost?: boolean;
}
declare function allowlistPlugin(options?: Options): Plugin;

export { allowlistPlugin as default };
