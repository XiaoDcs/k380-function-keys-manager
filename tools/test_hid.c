#include <stdio.h>
#include <stdlib.h>
#include <wchar.h>
#include "hidapi.h"

#define HID_VENDOR_ID_LOGITECH    0x046d
#define HID_DEVICE_ID_K380        0xb342
#define MAX_STR 255

int main() {
    struct hid_device_info *devs, *cur_dev;
    hid_device *handle;
    wchar_t wstr[MAX_STR];
    int res;

    printf("Initializing hidapi...\n");
    res = hid_init();
    if (res != 0) {
        printf("Failed to initialize hidapi\n");
        return 1;
    }

    printf("Enumerating HID devices...\n");
    devs = hid_enumerate(0x0, 0x0);
    cur_dev = devs;
    
    int device_count = 0;
    int k380_found = 0;
    
    while (cur_dev) {
        device_count++;
        printf("Device %d:\n", device_count);
        printf("  VID: 0x%04hx PID: 0x%04hx\n", cur_dev->vendor_id, cur_dev->product_id);
        printf("  Path: %s\n", cur_dev->path);
        printf("  Serial: %ls\n", cur_dev->serial_number);
        printf("  Manufacturer: %ls\n", cur_dev->manufacturer_string);
        printf("  Product: %ls\n", cur_dev->product_string);
        printf("  Release: %hx\n", cur_dev->release_number);
        printf("  Interface: %d\n", cur_dev->interface_number);
        printf("  Usage (page): 0x%hx (0x%hx)\n", cur_dev->usage, cur_dev->usage_page);
        printf("\n");
        
        // Check if this is a K380
        if (cur_dev->vendor_id == HID_VENDOR_ID_LOGITECH && 
            cur_dev->product_id == HID_DEVICE_ID_K380) {
            printf("*** FOUND K380! ***\n");
            k380_found = 1;
            
            // Try to open the device
            printf("Attempting to open K380...\n");
            handle = hid_open_path(cur_dev->path);
            if (handle) {
                printf("Successfully opened K380!\n");
                
                // Get product string
                wstr[0] = 0x0000;
                res = hid_get_product_string(handle, wstr, MAX_STR);
                if (res >= 0) {
                    printf("Product String: %ls\n", wstr);
                }
                
                hid_close(handle);
            } else {
                printf("Failed to open K380: %ls\n", hid_error(NULL));
            }
            printf("\n");
        }
        
        cur_dev = cur_dev->next;
    }
    
    hid_free_enumeration(devs);

    printf("Total devices found: %d\n", device_count);
    printf("K380 found: %s\n", k380_found ? "YES" : "NO");
    
    if (!k380_found) {
        printf("\nTrying direct open...\n");
        handle = hid_open(HID_VENDOR_ID_LOGITECH, HID_DEVICE_ID_K380, NULL);
        if (handle) {
            printf("Direct open successful!\n");
            hid_close(handle);
        } else {
            printf("Direct open failed: %ls\n", hid_error(NULL));
        }
    }

    hid_exit();
    return 0;
} 