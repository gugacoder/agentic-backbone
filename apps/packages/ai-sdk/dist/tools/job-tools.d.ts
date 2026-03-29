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
    submit_job: import("ai").Tool<{
        command: string;
        timeout?: number | undefined;
    }, string>;
    list_jobs: import("ai").Tool<{}, string>;
    get_job: import("ai").Tool<{
        jobId: string;
    }, string>;
    kill_job: import("ai").Tool<{
        jobId: string;
    }, "Job killed successfully" | "Job not found or already finished">;
};
