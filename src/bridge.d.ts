export type RecentProject = { path: string; title: string; openedAt: string };
export type BackupItem={id:string;createdAt:string;title:string;reason:string;bytes:number;hash:string};
export type FileState = { path: string | null; recent: RecentProject[];backupWarning?:string };
export type ExportTarget='web'|'windows'|'macos';
export type ExportFormat='directory'|'zip'|'dmg'|'installer'|'portable';
export type ExportResult={path:string;target:ExportTarget;launchable:boolean;appPath?:string;executable?:string;arch?:string;format?:ExportFormat;artifactPath?:string;signing?:string};
export type ExportEnvironment={platform:string;arch:string;signing?:{mac:boolean;windows:boolean}};
declare global {
  interface Window {
    studio?: {
      saveScript:(raw:string,title:string,format:'txt'|'csv')=>Promise<boolean>;
      listBackups:(key:string)=>Promise<BackupItem[]>;
      readBackup:(key:string,id:string)=>Promise<string>;
      createBackup:(raw:string,reason:string)=>Promise<BackupItem>;
      savePlayData:(raw:string,title?:string)=>Promise<boolean>;
      openPlayData:()=>Promise<string|null>;
      saveNew: (data: string) => Promise<FileState | null>;
      requestClose: () => Promise<void>;
      close: () => Promise<void>;
      onCloseRequested: (callback: () => void) => () => void;
      save: (data: string, saveAs?: boolean) => Promise<FileState | null>;
      open: () => Promise<{ content: string; path: string } | null>;
      fileState: () => Promise<FileState>;
      activateProject: (path: string | null, title: string) => Promise<FileState>;
      openRecent: (path: string) => Promise<{ content: string; path: string }>;
      exportOptions: () => Promise<ExportEnvironment>;
      launchGame: (root:string) => Promise<void>;
      revealExport: (root:string) => Promise<void>;
      exportGame: (request: { project: string; target: ExportTarget;format?:ExportFormat;signing?:'local'|'distribution' }) => Promise<ExportResult | null>;
      onExportProgress: (callback: (message: string) => void) => () => void;
    };
    game?: { project: () => Promise<string>;savePlayData?:(raw:string,title?:string)=>Promise<boolean>;openPlayData?:()=>Promise<string|null> };
  }
}
