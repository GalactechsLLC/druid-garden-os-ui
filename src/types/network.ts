/**
 * WiFi network device information
 */
export interface NetworkDevice {
    /** Network name */
    ssid: string;
    /** MAC address of access point */
    bssid: string;
    /** Signal strength in dBm */
    signal: number;
    /** Frequency in MHz */
    frequency: number;
    /** Whether network requires authentication */
    secure: boolean;
    /** Whether currently connected to this network */
    connected: boolean;
}

/**
 * Hotspot configuration settings
 */
export interface HotspotSettings {
    ssid: string;
    password: string;
}

/**
 * Network interface information and statistics
 */
export interface NetworkInfo {
    /** Interface name (e.g., eth0, wlan0) */
    name: string;
    ip_addresses: IpAddressData[];
    mac_address: string;
    /** Total bytes downloaded */
    data_downloaded: number;
    /** Total bytes uploaded */
    data_uploaded: number;
}

/**
 * IP address configuration data
 */
export interface IpAddressData {
    /** IP address */
    address: string;
    /** Subnet mask in CIDR notation */
    net_mask: number;
    /** Gateway IP address */
    gateway: string;
}