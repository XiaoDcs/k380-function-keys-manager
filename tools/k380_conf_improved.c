/*
 * K380 Function Keys Configuration - Improved Version
 * Based on k380_conf.c by Jerguš Greššák
 * Enhanced with persistence and better error handling
 */
#include <sys/ioctl.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <errno.h>
#include <signal.h>
#include <time.h>
#include "hidapi.h"

#define HID_VENDOR_ID_LOGITECH          0x046d
#define HID_DEVICE_ID_K380              0xb342
#define MAX_STR 255
#define RECONNECT_INTERVAL 5  // seconds
#define MAX_RETRIES 3

const unsigned char k380_seq_fkeys_on[]  = {0x10, 0xff, 0x0b, 0x1e, 0x00, 0x00, 0x00};
const unsigned char k380_seq_fkeys_off[] = {0x10, 0xff, 0x0b, 0x1e, 0x01, 0x00, 0x00};

const char opt_on[]  = "on";
const char opt_off[] = "off";
const char opt_monitor[] = "monitor";

static volatile int keep_running = 1;
static int monitor_mode = 0;
static int target_state = 1; // 1 for on, 0 for off

void signal_handler(int signum) {
    printf("\nReceived signal %d, shutting down gracefully...\n", signum);
    keep_running = 0;
}

int send_configuration(hid_device *fd, const unsigned char * buf, const int len)
{
    int res;

    /* Send sequence to the Device */
    res = hid_write(fd, buf, len);

    if (res < 0)
    {
        printf("Error: %s\n", hid_error(fd));
        return -1;
    }
    else if (res == len)
    {
        printf("[%s] Configuration sent successfully.\n", 
               target_state ? "ON" : "OFF");
        return 0;
    }
    else
    {
        printf("Warning: %d bytes written instead of %d.\n", res, len);
        return -1;
    }
}

hid_device* find_and_open_k380() {
    hid_device *fd = NULL;
    
    // Try to open the device
    fd = hid_open(HID_VENDOR_ID_LOGITECH, HID_DEVICE_ID_K380, NULL);
    
    if (fd) {
        wchar_t wstr[MAX_STR];
        int res;
        
        // Verify it's actually a K380 by reading product string
        wstr[0] = 0x0000;
        res = hid_get_product_string(fd, wstr, MAX_STR);
        if (res >= 0) {
            printf("Found device: %ls\n", wstr);
        }
        
        // Read serial number for identification
        wstr[0] = 0x0000;
        res = hid_get_serial_number_string(fd, wstr, MAX_STR);
        if (res >= 0) {
            printf("Serial Number: %ls\n", wstr);
        }
    }
    
    return fd;
}

int apply_k380_setting(int fn_keys_on) {
    hid_device *fd = NULL;
    int res = -1;
    int retry_count = 0;
    
    while (retry_count < MAX_RETRIES) {
        fd = find_and_open_k380();
        
        if (!fd) {
            printf("Attempt %d: K380 not found or cannot be opened\n", retry_count + 1);
            retry_count++;
            if (retry_count < MAX_RETRIES) {
                sleep(1);
            }
            continue;
        }
        
        // Apply the setting
        if (fn_keys_on) {
            res = send_configuration(fd, k380_seq_fkeys_on, sizeof(k380_seq_fkeys_on));
        } else {
            res = send_configuration(fd, k380_seq_fkeys_off, sizeof(k380_seq_fkeys_off));
        }
        
        // Close the device
        hid_close(fd);
        
        if (res == 0) {
            printf("Setting applied successfully\n");
            return 0;
        }
        
        retry_count++;
        if (retry_count < MAX_RETRIES) {
            printf("Retrying in 1 second...\n");
            sleep(1);
        }
    }
    
    printf("Failed to apply setting after %d attempts\n", MAX_RETRIES);
    return -1;
}

void monitor_k380() {
    printf("Starting K380 monitoring mode...\n");
    printf("Target state: Function keys %s\n", target_state ? "ON" : "OFF");
    printf("Press Ctrl+C to stop monitoring\n\n");
    
    time_t last_success = 0;
    int last_device_state = -1; // -1: unknown, 0: disconnected, 1: connected
    
    while (keep_running) {
        hid_device *fd = find_and_open_k380();
        
        if (fd) {
            // Device is connected
            if (last_device_state != 1) {
                printf("[%s] K380 connected, applying settings...\n", 
                       target_state ? "ON" : "OFF");
                last_device_state = 1;
            }
            
            // Apply settings
            int res;
            if (target_state) {
                res = send_configuration(fd, k380_seq_fkeys_on, sizeof(k380_seq_fkeys_on));
            } else {
                res = send_configuration(fd, k380_seq_fkeys_off, sizeof(k380_seq_fkeys_off));
            }
            
            if (res == 0) {
                last_success = time(NULL);
            }
            
            hid_close(fd);
        } else {
            // Device is not connected
            if (last_device_state != 0) {
                printf("K380 disconnected, waiting for reconnection...\n");
                last_device_state = 0;
            }
        }
        
        // Wait before next check
        sleep(RECONNECT_INTERVAL);
        
        // Show periodic status
        time_t current_time = time(NULL);
        if (current_time - last_success > 60) { // Show status every minute when no success
            if (last_device_state == 1) {
                printf("Status: Device connected, last successful config: %lds ago\n", 
                       current_time - last_success);
            } else {
                printf("Status: Waiting for K380 connection...\n");
            }
        }
    }
    
    printf("\nMonitoring stopped.\n");
}

void print_usage(const char* program_name) {
    printf("Logitech K380 Keyboard Configurator (Enhanced Version)\n\n");
    printf("Usage: %s [OPTIONS]\n\n", program_name);
    printf("Options:\n");
    printf("  -f {on|off}     Enable/disable direct access to F-keys\n");
    printf("  -m {on|off}     Monitor mode - continuously apply setting when device reconnects\n");
    printf("  -h              Show this help message\n");
    printf("\nExamples:\n");
    printf("  %s -f on        Enable F-keys once\n", program_name);
    printf("  %s -m on        Monitor and maintain F-keys enabled\n", program_name);
    printf("  %s -m off       Monitor and maintain F-keys disabled\n", program_name);
    printf("\nMonitor mode is useful to maintain settings after Bluetooth reconnections.\n");
}

int main(int argc, char **argv)
{
    int res;
    int flag_fkeys = 1;
    int c;

    if (argc < 2)
    {
        print_usage(argv[0]);
        return 1;
    }

    // Set up signal handlers for graceful shutdown
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);

    while ((c = getopt (argc, argv, "f:m:h")) != -1)
    {
        switch (c)
        {
            case 'f':
                if (strcmp(opt_on, optarg) == 0)
                {
                    flag_fkeys = 1;
                }
                else if (strcmp(opt_off, optarg) == 0)
                {
                    flag_fkeys = 0;
                }
                else
                {
                    fprintf (stderr, "Option -%c requires argument '%s' or '%s'.\n", c, opt_on, opt_off);
                    return 1;
                }
                break;
            case 'm':
                monitor_mode = 1;
                if (strcmp(opt_on, optarg) == 0)
                {
                    target_state = 1;
                }
                else if (strcmp(opt_off, optarg) == 0)
                {
                    target_state = 0;
                }
                else
                {
                    fprintf (stderr, "Option -%c requires argument '%s' or '%s'.\n", c, opt_on, opt_off);
                    return 1;
                }
                break;
            case 'h':
                print_usage(argv[0]);
                return 0;
            case '?':
                if (optopt == 'f' || optopt == 'm')
                {
                    fprintf (stderr, "Option -%c requires an argument.\n", optopt);
                }
                else if (isprint (optopt))
                {
                    fprintf (stderr, "Unknown option `-%c'.\n", optopt);
                }
                else
                {
                    fprintf (stderr, "Unknown option character `\\x%x'.\n", optopt);
                }
                return 1;
            default:
                print_usage(argv[0]);
                return 1;
        }
    }

    // Initialize the hidapi library
    res = hid_init();
    if (res != 0) {
        printf("Failed to initialize hidapi library\n");
        return 1;
    }

    if (monitor_mode) {
        // Run in monitoring mode
        monitor_k380();
    } else {
        // Run once
        res = apply_k380_setting(flag_fkeys);
        if (res != 0) {
            printf("Failed to apply K380 configuration\n");
            hid_exit();
            return 1;
        }
    }

    // Finalize the hidapi library
    res = hid_exit();
    return 0;
} 