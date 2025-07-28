export interface FarmerConfig {
    selected_network: 'mainnet' | 'testnet11';
    ssl_root_path: string | null;
    fullnode_ws_host: string;
    fullnode_ws_port: number;
    fullnode_rpc_host: string;
    fullnode_rpc_port: number;

    farmer_info: Array<{
        farmer_secret_key: string;
        launcher_id: string;
        pool_secret_key: string;
        owner_secret_key: string;
        auth_secret_key: string;
    }>;

    pool_info: Array<{
        launcher_id: string;
        pool_url: string;
        target_puzzle_hash: string;
        payout_instructions: string;
        p2_singleton_puzzle_hash: string;
        owner_public_key: string;
        difficulty: number | null;
    }>;

    payout_address: string;

    harvester_configs: {
        druid_garden: null | Record<string, any>;
        custom_config: {
            plot_directories: string[];
            parallel_read: boolean;
            max_cpu_cores: number;
            max_cuda_devices: number;
            max_opencl_devices: number;
            cuda_device_list: number[];
            opencl_device_list: number[];
            recompute_host: string;
            recompute_port: number;
        };
    };

    metrics: {
        enabled: boolean;
        port: number;
    };
}

export interface LogEntry {
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'TRACE';
    target?: string;
    message: string;
    timestamp: number[] | Date;
    uuid?: string;
}

export type LogLevelValue = 'ALL' | 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogLevelOption {
    label: string;
    value: LogLevelValue;
}

export const MAX_HISTORY_POINTS = 1000;

export const logLevels: LogLevelOption[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Trace', value: 'TRACE' },
    { label: 'Debug', value: 'DEBUG' },
    { label: 'Info', value: 'INFO' },
    { label: 'Warning', value: 'WARN' },
    { label: 'Error', value: 'ERROR' }
];

export interface FarmerActivity {
    passedFilter: {
        og: { processed: number; total: number };
        nft: { processed: number; total: number };
        compressed: { processed: number; total: number };
    };
    proofsFound: number;
    partialsFound: {
        nft: number;
        compressed: number;
    };
}

export interface FarmerActivityRecord {
    timestamp: Date;
    activity: FarmerActivity;
    metadata?: {
        challenge_hash: string;
        sp_hash: string;
        full_node_height: number;
        full_node_difficulty: number;
        full_node_synced: boolean;
        total_plot_space: number;
    };
}

export interface FarmerState {
    running: boolean;
    plot_counts: PlotCounts;
    blockchain_state: BlockchainState;
    config: FarmerConfig;
}

export interface PlotCounts {
    og_plot_count: number;
    nft_plot_count: number;
    compressed_plot_count: number;
    invalid_plot_count: number;
    total_plot_space: number;
}

export interface Peak {
    header_hash: string;
    prev_hash: string;
    height: number;
    weight: number;
    total_iters: number;
    signage_point_index: number;
    challenge_vdf_output: { data: string };
    infused_challenge_vdf_output: { data: string };
    reward_infusion_new_challenge: string;
    challenge_block_info_hash: string;
    sub_slot_iters: number;
    pool_puzzle_hash: string;
    farmer_puzzle_hash: string;
    required_iters: number;
    deficit: number;
    overflow: boolean;
    prev_transaction_block_height: number;
    timestamp: number | null;
    prev_transaction_block_hash: string | null;
    fees: any;
    reward_claims_incorporated: any;
    finished_challenge_slot_hashes: any;
    finished_infused_challenge_slot_hashes: any;
    finished_reward_slot_hashes: any;
    sub_epoch_summary_included: any;
}

export interface SyncState {
    sync_mode: boolean;
    synced: boolean;
    sync_tip_height: number;
    sync_progress_height: number;
}

export interface BlockchainState {
    peak: Peak | null;
    genesis_challenge_initialized: boolean;
    sync: SyncState;
    difficulty: number;
    sub_slot_iters: number;
    space: number;
    mempool_size: number;
    mempool_cost: number;
    mempool_min_fees: Record<string, number>;
    mempool_max_total_cost: number;
    block_max_cost: number;
    node_id: string;
}

export const DEFAULT_FARMER_CONFIG: FarmerConfig = {
    selected_network: 'mainnet',
    ssl_root_path: null,
    fullnode_ws_host: 'druid.garden',
    fullnode_ws_port: 443,
    fullnode_rpc_host: 'druid.garden',
    fullnode_rpc_port: 443,

    farmer_info: [{
        farmer_secret_key: '',
        launcher_id: '',
        pool_secret_key: '',
        owner_secret_key: '',
        auth_secret_key: '',
    }],

    pool_info: [{
        launcher_id: '',
        pool_url: '',
        target_puzzle_hash: '',
        payout_instructions: '',
        p2_singleton_puzzle_hash: '',
        owner_public_key: '',
        difficulty: null,
    }],

    payout_address: '',

    harvester_configs: {
        druid_garden: null,
        custom_config: {
            plot_directories: ['/mnt/'],
            parallel_read: true,
            max_cpu_cores: -1,
            max_cuda_devices: -1,
            max_opencl_devices: -1,
            cuda_device_list: [],
            opencl_device_list: [],
            recompute_host: '',
            recompute_port: 0,
        },
    },

    metrics: {
        enabled: true,
        port: 8080,
    },
};

export interface FarmerTestResult {
    success: boolean;
    message?: string;
}

export interface FarmerActionResult {
    success: boolean;
    message?: string;
    data?: any;
}

export interface MnemonicGenerationResult {
    success: boolean;
    config: FarmerConfig;
    message?: string;
}
