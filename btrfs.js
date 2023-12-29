import path from 'node:path';
import fs from 'node:fs/promises';

import {$} from 'execa';

import {debug, verbose, info, error} from './logger.js';

export default class Btrfs {
    #config;

    constructor(config) {
        this.#config = config;
    }

    async setupDisk(globalConf) {
        const { root } = globalConf;
        info(`Setting up the disk/root at ${root}`);
        
        let exists = true;
        debug('Checking if root exists');
        try { await fs.access(root); }
        catch { exists = false; }
        debug(`Root exists? ${exists}`);
        if (exists && this.#config.deleteExisting) {
            verbose("Root already exists. Deleting it.");
            const { stdout } = await $`btrfs subvolume list -o ${root}`;
            const re = /path (.+)/g;
            let match = re.exec(stdout);
            while (match != null) {
                const subvol = path.join(this.#config.root, match[1]);
                debug(`Deleting inner subvolume ${subvol}`);
                await $`btrfs subvolume delete -c ${subvol}`;
                match = re.exec(stdout);
            }
            await $`btrfs subvolume delete -c ${root}`;
            debug('Root deleted');
            exists = false;
        }

        if (!exists && this.#config.create) {
            verbose('Creating root');
            await $`btrfs subvolume create ${root}`;
        } else if (!exists) {
            throw new Error(`Subvolume does not exist and create is disabled: ${root}`);
        }
    }

    packages(globalConf) {
        return ["btrfs-progs"];
    }
}