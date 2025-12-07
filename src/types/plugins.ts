/**
 * Plugin configuration and metadata
 */
export interface Plugin {
    id?: number;
    name: string;
    label: string;
    /** 1 for enabled, 0 for disabled */
    enabled: number;
    plugin_type: string;
    /** Git repository URL */
    repo: string;
    /** Git tag or branch */
    tag: string;
    source: string;
    run_command: string;
    /** ISO date string when plugin was added */
    added: string;
    /** ISO date string when plugin was last updated */
    updated: string;
    version?: string;
    install_dir?: string;
    environment?: string;
    past_versions?: any[];
}

/**
 * Current runtime status of a plugin
 */
export interface PluginStatus {
    /** Whether plugin is currently running */
    running: boolean;
    /** Whether plugin is configured to run */
    should_be_running: boolean;
    /** ISO date string when plugin was started, null if never started */
    started: string | null;
}