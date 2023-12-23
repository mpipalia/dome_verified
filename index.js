// installed packages: nodejs, pnpm, base, linux, linux-firmware
// maybe need: btrfs-progs, kexec-tools

import path from 'node:path';
import fs from 'node:fs/promises';
import process from 'node:process';

import {$} from 'execa';
import {stripIndent} from 'proper-tags';

const config = {
    btrfsRoot: '/mnt/btrfs',
    packages: ['base', 'linux', 'linux-firmware', 'nodejs', 'pnpm', 'arch-install-scripts', 'helix', 'btrfs-progs',],
    ipLink: 'enp5s0',
    hostname: 'archy2',
    // password is 'helloworld'
    rootPass: '$y$j9T$ofhPpU.eUZDOpBz.qevxI0$4jlFGtOTNf6jdCEunbyQdb2gMW/uXjjEySt0XgaUIZ/',
}

const newPath = path.join(config.btrfsRoot, 'roots', 'new');
if (!process.argv.some(a => a === '--chroot')) {
    await $`btrfs subvolume create ${newPath}`;

    if (!process.argv.some(a => a === '--nopacstrap'))
    {
        await $`pacstrap ${newPath} ${config.packages}`;
    }

    await fs.rm(path.join(newPath, 'etc/resolv.conf'));
    await fs.symlink('../run/systemd/resolve/resolv.conf', path.join(newPath, 'etc/resolv.conf'));

    await fs.writeFile(path.join(newPath, 'etc/fstab'), stripIndent`
        # Static information about the filesystems.
        # See fstab(5) for details.

        # <file system> <dir> <type> <options> <dump> <pass>
        # /dev/vda3 LABEL=archy
        UUID=9d993c21-56fe-4ed1-8eac-2f4462ebcbea   /           btrfs   rw,noatime,compress=zstd,subvol=/roots/active	0 0
        UUID=9d993c21-56fe-4ed1-8eac-2f4462ebcbea   /mnt/btrfs  btrfs   rw,noatime,compress=zstd,subvol=/               0 0

        # /dev/vda1
        UUID=40F6-BA42                              /boot       vfat    rw,noatime,errors=remount-ro                    0 2
    `);

    const localeGen = [
        {search: '#en_US.UTF-8 UTF-8', replace: 'en_US.UTF-8 UTF-8'},
    ];
    await replace(path.join(newPath, 'etc/locale.gen'), localeGen);

    await fs.writeFile(path.join(newPath, 'etc/locale.conf'), 'LANG=en_US.UTF-8\n');

    await dhcp(config.ipLink);

    await fs.writeFile(path.join(newPath, 'etc/hostname'), config.hostname + '\n');

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
    await $`mount --bind --mkdir ${process.cwd()} ${path.join(newPath, 'root/untouch')}`;
    console.log('chrooting');
    await $`arch-chroot ${newPath} node /root/untouch/index.js --chroot`
    console.log('done chrooting');
    await $`umount ${path.join(newPath, 'root/untouch')}`;
    await $`umount ${newPath}`;
}
else {
    await $`locale-gen`;
    await $`systemctl enable systemd-networkd`;
    await $`systemctl enable systemd-resolved`;
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