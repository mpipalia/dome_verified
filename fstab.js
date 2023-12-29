import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {debug, verbose, info, error} from './logger.js';

export default class Fstab {
    #config;
    constructor(config) {
        this.#config = config;
    }

    async preChroot(globalConf) {
        info('Creating /etc/fstab');
        const { root } = globalConf;

        const maxBlock = Math.max(...this.#config.map(
            c => c.block?.length ?? c.label?.length ?? c.uuid?.length ?? c.partLabel?.length ?? c.partUuid?.length)) +
            'PARTLABEL='.length; // the biggest prefix
        const maxMount = Math.max(...this.#config.map(c => c.mount.length));
        const maxType = Math.max(...this.#config.map(c => c.type.length));
        const maxOptions = Math.max(...this.#config.map(c => c.options.length));
        debug(`block: ${maxBlock}; mount: ${maxMount}; type: ${maxType}; options: ${maxOptions}`);
        //throw new Error("debugging");

        const file = await fs.open(path.join(root, 'etc/fstab'), 'w');
        for (let part of this.#config) {
            let block = part.block;
            if (part.label) {
                block = `LABEL=${part.label}`;
            } else if (part.uuid) {
                block = `UUID=${part.uuid}`;
            } else if (part.partLabel) {
                block = `PARTLABEL=${part.partLabel}`;
            } else if (part.partUuid) {
                block = `PARTUUID=${part.partUuid}`;
            }
            if (!block) {
                throw new Error(`No block/label/uuid provided for this mount point: ${part.mount}`);
            }

            verbose(`Adding block device ${block} to mount point ${part.mount} (${part.type})`);
            const dump = part.dump ?? '0';
            const fsck = part.fsck ?? '0';
            await file.write(`${block.padEnd(maxBlock)} ${part.mount.padEnd(maxMount)} ${part.type.padEnd(maxType)} ${part.options.padEnd(maxOptions)} ${dump} ${fsck}${os.EOL}`);
        }
        await file.close();
    }
}