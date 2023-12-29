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

            const dump = part.dump ?? '0';
            const fsck = part.fsck ?? '0';
            await file.write(`${block} ${part.mount} ${part.type} ${part.options} ${dump} ${fsck}`);
        }
        await file.close();
    }
}