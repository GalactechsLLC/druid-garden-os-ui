;export interface Plugin {
    id?: number;
    name: string;
    label: string;
    enabled: number;
    plugin_type: string;
    repo: string;
    tag: string;
    source: string;
    run_command: string;
    added: string;
    updated: string;
    version?: string;
    install_dir?: string;
    environment?: string;
    past_versions?: any[];
}

export interface PluginStatus {
    running: boolean
    should_be_running: boolean
    started: string | null
}