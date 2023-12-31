// installed packages: nodejs, pnpm, base, linux, linux-firmware
// maybe need: btrfs-progs, kexec-tools

import path from 'node:path';
import fs from 'node:fs/promises';
import process from 'node:process';

import {$} from 'execa';
import {stripIndent} from 'proper-tags';

import {debug, verbose, info, error} from './logger.js';
import Btrfs from './btrfs.js';
import Machine from './machine.js';
import SystemdNetworkd from './systemdNetworkd.js';
import SystemdResolved from './systemdResolved.js';
import Fstab from './fstab.js';
import Locale from './locale.js';

const config = {
    root: '/mnt/btrfs/roots/new',
    packages: ['base', 'linux', 'linux-firmware', 'efibootmgr', 'git', 'nodejs', 'pnpm', 'arch-install-scripts', 'helix', 'btrfs-progs',],
    ipLink: 'enp5s0',
    hostname: 'archy2',
    pacstrap: {
        hostPackageCache: true,
    },
    // password is 'helloworld'
    rootPass: '$y$j9T$ofhPpU.eUZDOpBz.qevxI0$4jlFGtOTNf6jdCEunbyQdb2gMW/uXjjEySt0XgaUIZ/',
}
const btrfsUuid = 'fa906a4d-cfad-48c1-830f-249b00310164';
const globalConf = {
    disk: new Btrfs({create: true, deleteExisting: true, root: '/mnt/btrfs'}),
    root: '/mnt/btrfs/roots/new',
    basePackages: ['base', 'linux', 'linux-firmware', 'arch-install-scripts'],
    //extraPackages: ['man-db', 'man-pages', 'git', 'helix', 'nodejs', 'pnpm', 'zellij'],
    extraPackages: ['nodejs'],
    modules: [
        new Machine({machineId: 'd792158c4ab86429bce1d84344bd3165', hostname: 'archy2'}),
        new SystemdResolved({mode: SystemdResolved.Mode.DIRECT}),
        new Fstab([
            {uuid: btrfsUuid, mount: '/', type: 'btrfs', options: 'rw,noatime,compress=zstd,subvol=/roots/active'},
            {uuid: btrfsUuid, mount: '/mnt/btrfs', type: 'btrfs', options: 'rw,noatime,compress=zstd,subvol=/'},
            {uuid: 'DE03-CB9A', mount: '/boot', type: 'vfat', options: 'rw,noatime,errors=remount-ro', fsck: 2},
            // swap
            {uuid: '55623361-cd1c-4908-9328-afdc36271e3f', mount: 'none', type: 'swap', options: 'defaults'},
        ]),
        new Locale(['en_US.UTF-8 UTF-8']),
        new SystemdNetworkd([
            {
                filename: '20-enp5s0',
                Match: { Name: 'enp5s0' },
                Network: { DHCP: 'yes' },
                DHCPv4: { UseDomains: 'yes' },
            },
        ]),
    ],
}

const newPath = config.root;

async function doit() {
    if (process.argv.some(a => a === '--machineid')) {
        let id = Math.floor(2**32 * Math.random()).toString(16).padStart(8, '0');
        id += Math.floor(2**32 * Math.random()).toString(16).padStart(8, '0');
        id += Math.floor(2**32 * Math.random()).toString(16).padStart(8, '0');
        id += Math.floor(2**32 * Math.random()).toString(16).padStart(8, '0');
        console.log(id);
        return;
    }

    if (!process.argv.some(a => a === '--chroot')) {
        //await $`btrfs subvolume create ${newPath}`;
        await globalConf.disk.setupDisk(globalConf);

        if (!process.argv.some(a => a === '--nopacstrap'))
        {
            const packages = new Array(...globalConf.basePackages);
            packages.push(...globalConf.extraPackages);
            for (let mod of [globalConf.disk, ...globalConf.modules]) {
                if (typeof mod.packages === 'function') {
                    packages.push(...mod.packages(globalConf));
                }
            }
            const hostPackageCache = config.pacstrap.hostPackageCache ? '-c' : '';
            await $`pacstrap ${hostPackageCache} ${newPath} ${packages}`;
        }

        //await fs.rm(path.join(newPath, 'etc/resolv.conf'));
        //await fs.symlink('../run/systemd/resolve/resolv.conf', path.join(newPath, 'etc/resolv.conf'));
        for (let mod of globalConf.modules) {
            if (typeof mod.preChroot === 'function') {
                const awaitable = mod.preChroot(globalConf);
                if (awaitable && typeof awaitable.then === 'function') {

                    await awaitable;
                }
            }
        }

        /*await fs.writeFile(path.join(newPath, 'etc/fstab'), stripIndent`
            # Static information about the filesystems.
            # See fstab(5) for details.

            # <file system> <dir> <type> <options> <dump> <pass>
            # /dev/vda3 LABEL=archy
            UUID=9d993c21-56fe-4ed1-8eac-2f4462ebcbea   /           btrfs   rw,noatime,compress=zstd,subvol=/roots/active	0 0
            UUID=9d993c21-56fe-4ed1-8eac-2f4462ebcbea   /mnt/btrfs  btrfs   rw,noatime,compress=zstd,subvol=/               0 0

            # /dev/vda1
            UUID=40F6-BA42                              /boot       vfat    rw,noatime,errors=remount-ro                    0 2
        `);*/

        /*const localeGen = [
            {search: '#en_US.UTF-8 UTF-8', replace: 'en_US.UTF-8 UTF-8'},
        ];
        await replace(path.join(newPath, 'etc/locale.gen'), localeGen);

        await fs.writeFile(path.join(newPath, 'etc/locale.conf'), 'LANG=en_US.UTF-8\n');*/

        //await dhcp(config.ipLink);

        //await fs.writeFile(path.join(newPath, 'etc/hostname'), config.hostname + '\n');

        await replace(path.join(newPath, 'etc/shadow'), [
            {search: /^root:[^:]*:/m, replace: `root:${config.rootPass}:`},
        ]);

        await fs.writeFile(path.join(newPath, 'etc/kernel/cmdline'), 'root=UUID=9d993c21-56fe-4ed1-8eac-2f4462ebcbea rw zswap.compressor=zstd rootflags=subvol=/roots/active\n');

        await replace(path.join(newPath, 'etc/mkinitcpio.d/linux.preset'),[
            {search: /^default_image=/m, replace: '#$&'},
            {search: /^fallback_image=/m, replace: '#$&'},
            {search: /^#default_uki=.*/m, replace: 'default_uki="/boot/arch-new.efi"'},
            {search: /^#fallback_uki=.*/m, replace: 'fallback_uki="/boot/arch-new-fallback.efi"'},
        ]);

        await $`mount --bind ${newPath} ${newPath}`;
        await fs.rm(path.join(newPath, 'boot'), { recursive: true });
        await $`mount --bind --mkdir /boot ${path.join(newPath, 'boot')}`;
        await $`mount --bind --mkdir ${process.cwd()} ${path.join(newPath, 'root/untouch')}`;
        info('chrooting');
        await $({stdio: 'inherit'})`arch-chroot ${newPath} node /root/untouch/index.js --chroot`
        info('done chrooting');
        await $`umount ${path.join(newPath, 'boot')}`;
        await $`umount ${path.join(newPath, 'root/untouch')}`;
        await $`umount ${newPath}`;
    }
    else {
        for (let mod of globalConf.modules) {
            if (typeof mod.postChroot === 'function') {
                const awaitable = mod.postChroot(globalConf);
                if (awaitable && typeof awaitable.then === 'function') {

                    await awaitable;
                }
            }
        }

        //await $`locale-gen`;
        //await $`systemctl enable systemd-networkd`;
        //await $`systemctl enable systemd-resolved`;
        await $`mkinitcpio -P`;
    }
}

async function replace(file, replaces) {
    let data = await fs.readFile(file, { encoding: 'utf-8'});
    for (const r of replaces) {
        data = data.replace(r.search, r.replace);
    }
    await fs.writeFile(file, data);
}

async function dhcp(link) {
    await fs.writeFile(path.join(newPath, `etc/systemd/network/20-${link}.network`), stripIndent`
        [Match]
        Name=${link}

        [Network]
        DHCP=yes

        [DHCPv4]
        UseDomains=yes
    `);
}

await doit();