import path from 'node:path';
import fs from 'node:fs/promises';

import {debug, verbose, info, error} from './logger.js';

export default class SystemdResolved {
    #config;
    constructor(config) {
        this.#config = config;
    }

    async preChroot(globalConf) {
        info('Setting up systemd-resolved');
        const { root } = globalConf;

        verbose(`Creating symbolic link /etc/resolv.conf using mode ${this.#config.mode.description}`);
        await fs.rm(path.join(root, 'etc/resolv.conf'));
        switch (this.#config.mode) {
            case SystemdResolved.Mode.STUB: {
                await fs.symlink('../run/systemd/resolve/stub-resolv.conf', path.join(root, 'etc/resolv.conf'));
            }
            case SystemdResolved.Mode.STATIC: {
                await fs.symlink('../usr/lib/systemd/resolv.conf', path.join(root, 'etc/resolv.conf'));
            }
            case SystemdResolved.Mode.DIRECT: {
                await fs.symlink('../run/systemd/resolve/resolv.conf', path.join(root, 'etc/resolv.conf'));
            }
        }
    }

    static Mode = Object.freeze({
        STUB: Symbol('stub'),
        STATIC: Symbol('static'),
        DIRECT: Symbol('direct'),
    })
}