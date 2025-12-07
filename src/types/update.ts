/**
 * System update information from the server
 */
export interface UpdateInfo {
    local_version: string;
    remote_version: string;
    has_update: boolean;
}