import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {debug, verbose, info, error} from './logger.js';

export default class Machine {
    /**
     * The configuration
     * @type {{machineId: string, hostname: string}}
    */
    #config

    /**
     * 
     * @param {{machineId: string, hostname: string}} config Machine information
     */
    constructor(config) {
        this.#config = config;
    }

    async preChroot(globalConf) {
        info('Setting up machine-id and hostname');
        const { root } = globalConf;
        
        verbose(`Creating /etc/machine-id with ${this.#config.machineId}`);
        await fs.writeFile(path.join(root, 'etc/machine-id'), `${this.#config.machineId}` + os.EOL);
        verbose(`Creating /etc/hostname with ${this.#config.hostname}`);
        await fs.writeFile(path.join(root, 'etc/hostname'), this.#config.hostname + os.EOL);
    }
}