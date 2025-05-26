export type SystemSetupStatus = {
    setupNeeded: boolean;
    currentStep?: number;
    networkConfigured?: boolean;
    farmerConfigured?: boolean;
};
