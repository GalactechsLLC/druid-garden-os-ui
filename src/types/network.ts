export interface NetworkDevice {
    ssid: string;
    bssid: string;
    signal: number;
    frequency: number;
    secure: boolean;
    connected: boolean;
}

export interface HotspotSettings {
    ssid: string;
    password: string;
}

export interface NetworkInterface {
    id: string;
    name: string;
    ipv4: string;
    status: "up" | "down";
    speed: number;
    received: number;
    sent: number;
    type: "wifi" | "ethernet" | "loopback" | "other";
}

export interface NetworkConfig {
    interfaceId: string;
    type: "wifi" | "ethernet";
    wifi?: {
        ssid: string;
        password: string;
        hidden: boolean;
    };
    ipConfig: {
        type: "dhcp" | "static";
        address?: string;
        netmask?: string;
        gateway?: string;
        dns?: string[];
    };
}

export interface NetworkInfo {
    name: string;
    ip_addresses: IpAddressData[];
    mac_address: string;
    data_downloaded: number;
    data_uploaded: number;
}

export interface IpAddressData {
    address: string;
    net_mask: number;
    gateway: string;
}

