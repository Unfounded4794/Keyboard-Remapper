# Linux device access

Use the actual vendor/product IDs from your keyboard's definition or `lsusb`. An administrator can adapt this example; `cafe` and `0010` are placeholders, not a real supported keyboard.

```udev
# /etc/udev/rules.d/70-keystone-keyboard.rules
SUBSYSTEM=="hidraw", ATTRS{idVendor}=="cafe", ATTRS{idProduct}=="0010", TAG+="uaccess"
```

Reload udev rules and reconnect the device. ZMK Studio USB serial also requires access to its serial device. The relevant group depends on the distribution, commonly `dialout` or `uucp`. Avoid broad permissions for every hidraw device, and do not run the desktop app as root.
