import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Notification,
  shell,
} from 'electron';
import fs from 'fs';
import path from 'path';
import { execFile } from 'node:child_process';
import pngquant from 'pngquant-bin';

export default class PngPlugin {
  private targetFolder = path.normalize(
    `${app.getPath('temp')}/compressed-files`
  );

  // eslint-disable-next-line no-useless-constructor, no-unused-vars, no-empty-function
  constructor(private mainWindow: BrowserWindow) {}

  static accessOrCreateFolder(
    folderPath: string,
    mode = fs.constants.W_OK
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const normalizePath = path.normalize(folderPath);
      fs.access(normalizePath, mode, (err) => {
        // err is null if normalizePath dosn't exist
        if (err) {
          // then create it
          fs.mkdir(normalizePath, (errSecond) => {
            if (errSecond) {
              reject();
              return;
            }
            resolve();
          });
          return;
        }
        resolve();
      });
    });
  }

  init(): void {
    PngPlugin.accessOrCreateFolder(this.targetFolder);
    new Notification({ body: pngquant, timeoutType: 'never' }).show();
    ipcMain.on('openFile', () => {
      let progress = 0;
      this.mainWindow.setProgressBar(progress);
      // dialog.showOpenDialog Open a dialog to select a file
      // In this example only files with extension ".png"
      dialog
        .showOpenDialog(this.mainWindow, {
          filters: [{ name: 'Images', extensions: ['png'] }],
          properties: ['openFile', 'multiSelections'],
        })
        .then((result) => {
          // Transform all file path to Promise and then is all promise are resolved continue script
          // https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
          return Promise.all(
            // Map transform array to other one
            // https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array/map
            result.filePaths.map(
              (filePath) =>
                new Promise<void>((resolve) => {
                  const fileName = path.basename(filePath);
                  // compress image
                  execFile(
                    // pngquant is software to compress image
                    pngquant.replace('app.asar', 'app.asar.unpacked'),
                    [
                      '--quality=90-100',
                      '-o',
                      `${this.targetFolder}/${fileName}`,
                      filePath,
                    ],
                    // @ts-ignore
                    () => {
                      // add progress and resolve promess i * 1000 timeout
                      progress += 100 / result.filePaths.length / 100;
                      this.mainWindow?.setProgressBar(progress);
                      resolve();
                    },
                    () => {
                      // in error case just resolve promess
                      resolve();
                    }
                  );
                })
            )
            // Then all promesse are resolved
          );
        })
        .then(() => {
          // Show notification
          new Notification({
            title: 'Compresseur PNG',
            body: 'Compression finit',
          }).show();
          // Reset progress bar
          this.mainWindow.setProgressBar(-1);
          // Open temp folder
          return shell.openPath(this.targetFolder);
        })
        .catch(() => {});
    });
  }
}
