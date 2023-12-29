import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {$} from 'execa';

import {debug, verbose, info, error} from './logger.js';

/**
 * @typedef {Object} Match
 * @prop {string} [MACAddress] the current MAC address
 * @prop {string} [PermanentMACAddress] the permanent MAC address
 * @prop {string} [Name] the name of the device
 */

/**
 * @typedef {Object} Network
 * @prop {string} [DHCP] Enables DHCP. Choices are 'yes', 'no', 'ipv4', and 'ipv6'
 * @prop {string[]} [Addresses] Static IPv4 or IPv6 addresses
 * @prop {string} [Gateway] The gateway address
 * @prop {string[]} [DNSes] DNS addresses
 * @prop {string} [IPForward] Enables IP packet forwarding. Choices are 'yes', 'no' (default), 'ipv4', 'ipv6'
 */

/**
 * @typedef {Object} DHCPv4
 * @prop {string} [ClientIdentifier] the client identifier to use. Choices are 'mac' and 'duid' (default).
 * @prop {string} [UseDomains] use search domains from DHCP server. Choices are 'yes', 'no' (default), or 'route'. 
 */

/**
 * @typedef {Object} Config
 * @prop {string} filename the filename, without the suffix, so use to create the configuration files
 * @prop {Match} [Match] The match section
 * @prop {Network} [Network] The network section
 * @prop {DHCPv4} [DHCPv4] the DHCPv4 section
 */

export default class SystemdNetworkd {
    /**
     * The configuration
     * @type {Config[]}
     */
    #config

    /**
     * Set up the network using systemd-networkd
     * @param {Config[]} config the networkd configuration
     */
    constructor(config) {
        this.#config = config;
    }

    async preChroot(globalConf) {
        info('Setting up network using systemd-networkd');
        const { root } = globalConf;

        for (let c of this.#config) {
            const filename = path.join(root, `etc/systemd/network/${c.filename}.network`);
            verbose(`Creating ${filename}`);
            const file = await fs.open(filename, 'w');
            if (c.Match) {
                await file.write('[Match]' + os.EOL);
                const match = c.Match;
                if (match.Name) {
                    await file.write(`Name=${match.Name}${os.EOL}`);
                }
                if (match.MACAddress) {
                    await file.write(`MACAddress=${match.MACAddress}${os.EOL}`);
                }
                if (match.PermanentMACAddress) {
                    await file.write(`PermanentMACAddress=${match.PermanentMACAddress}${os.EOL}`);
                }
                await file.write(os.EOL);
            }

            if (c.Network) {
                await file.write('[Network]' + os.EOL);
                const network = c.Network;
                if (network.DHCP) {
                    await file.write(`DHCP=${network.DHCP}${os.EOL}`);
                }
                if (network.IPForward) {
                    await file.write(`IPForward=${network.IPForward}${os.EOL}`);
                }
                if (network.Gateway) {
                    await file.write(`Gateway=${network.Gateway}${os.EOL}`);
                }
                if (network.Addresses) {
                    for (let addr of network.Addresses) {
                        await file.write(`Address=${addr}${os.EOL}`);
                    }
                }
                if (network.DNSes) {
                    for (let dns of network.DNSes) {
                        await file.write(`DNS=${dns}${os.EOL}`);
                    }
                }
                await file.write(os.EOL);
            }

            if (c.DHCPv4) {
                await file.write('[DHCPv4]' + os.EOL);
                const dhcp = c.DHCPv4;
                if (dhcp.UseDomains) {
                    await file.write(`UseDomains=${dhcp.UseDomains}${os.EOL}`);
                }
                if (dhcp.ClientIdentifier) {
                    await file.write(`ClientIdentifier=${dhcp.ClientIdentifier}${os.EOL}`);
                }
                await file.write(os.EOL);
            }

            await file.close();
        }
    }

    async postChroot(globalConf) {
        info('Enabling systemd-networkd');
        await $`systemctl enable systemd-networkd`;
    }
}