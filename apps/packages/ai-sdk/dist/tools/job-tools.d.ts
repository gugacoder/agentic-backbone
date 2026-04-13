export interface JobToolCallbacks {
    submitJob: (opts: {
        agentId: string;
        command: string;
        timeout?: number;
    }) => unknown;
    listJobs: (agentId?: string) => unknown[];
    getJob: (jobId: string) => unknown | undefined;
    killJob: (jobId: string) => boolean;
    getAgentId: () => string | undefined;
}
export declare function createJobTools(callbacks: JobToolCallbacks): {
    submit_job: any;
    list_jobs: any;
    get_job: any;
    kill_job: any;
};
