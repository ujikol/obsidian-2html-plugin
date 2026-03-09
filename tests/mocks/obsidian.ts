export class App {}
export class TFile {
    extension: string;
    path: string;
}
export class Notice {
    constructor(msg: string) {}
}

export function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/\//g, '/').replace(/^\/+/, '');
}
