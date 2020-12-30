import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
const shell = require('shelljs');

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);
// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfdx-git-deploy', 'org');

export default class Org extends SfdxCommand {

    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx git:code:deploy --targetusername myOrg@example.com`
    ];

    public static args = [{ name: 'file' }];

    protected static flagsConfig = {
        branch: flags.string({ char: 'b', description: messages.getMessage('branchFlagDescription') }),
        output: flags.string({ char: 'd', description: messages.getMessage('outputDirFlagDescription') }),
        testlevel: flags.string({ char: 'l', description: messages.getMessage('runTestsFlagDescription') }),
        projectfolder: flags.string({ char: 'p', description: messages.getMessage('projectFolderFlagDescription') }),
        includeuntracked: flags.boolean({ char: 'i', description: messages.getMessage('includeUntrackedFlagDescription') }),
        validateonly: flags.boolean({ char: 'v', description: messages.getMessage('validateFlagDescription') })
    };

    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    // Comment this out if your command does not support a hub org username
    // protected static supportsDevhubUsername = true;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;

    public async run(): Promise<any> {

        let numResults = 0;
        const results = [];

        // check if git is installe
        if (!shell.which('git')) {
            shell.echo('Sorry, this script requires git');
            shell.exit(1);
        }

        // check flags and set default values
        if (this.flags.branch == null) {
            this.ux.log('The local branch you need to compare to is missing ');
            return null;
        }

        if (this.flags.output == null) {
            this.ux.log('The output folder to put the files in is missing ');
            return null;
        }

        if (this.flags.testlevel == null) {
            this.ux.log('The test level is not set, so it will default to RunLocalTests. ');
            this.flags.testlevel = 'RunLocalTests';
        } 
        
        if (typeof this.flags.projectfolder == "undefined") {
            this.ux.log('The project folder is not set, so it will default to force-app. ');
            this.flags.projectfolder = 'force-app';
        }         

        if (typeof this.flags.includeuntracked == "undefined") {
            this.ux.log('The include untracked flag is not set, so it will default to false. ');
            this.flags.includeuntracked = false;
        }  
        
        if (typeof this.flags.validateonly == "undefined") {
            this.ux.log('The validate only flag is not set, so it will default to false. ');
            this.flags.validateonly = false;
        }          

        // Start preparing
        this.ux.log(`Preparing deployment`);
        this.ux.log(`====================`);
        this.ux.log(`Branch to compare: ${this.flags.branch}`);
        this.ux.log(`Path to put the files in: ${this.flags.output}`);
        this.ux.log(`Test level: ${this.flags.testlevel}`);
        this.ux.log(`Project Folder: ${this.flags.projectfolder}`);

        shell.config.verbose = false;

        this.ux.log(`Current working branch is : `);
        let workingBranch = shell.exec(`git rev-parse --abbrev-ref HEAD`);

        this.ux.log(`Checking for tracked files to deploy:`);

        this.ux.log(`Creating outpud dir: ${this.flags.output.replace('"', '')}`);

        shell.mkdir('-p', this.flags.output);

        let filesList = "";
        
        if (this.flags.branch === workingBranch) {
            // if we are on the same branch, compare commits
            this.ux.log('Getting files from latest commit');
            filesList = shell.exec(`git diff --no-renames --diff-filter=d --name-only --relative=${this.flags.projectfolder} HEAD HEAD~1`);
        } else {
            this.ux.log('Getting changed files from branch');
            filesList = shell.exec(`git diff --no-renames --diff-filter=d --name-only --relative=${this.flags.projectfolder} ${this.flags.branch} ${workingBranch}`);
        }

        // if there are no files to deploy
        if (typeof filesList == "undefined" || filesList.length == 0) {
            this.ux.log(`There are no tracked files to deploy, add at least a commit with the files you need to deploy.`);
            return null;
        }

        let filesListArr = filesList.split('\n');

        // If we are including untracked files
        if (this.flags.includeuntracked || this.flags.includeuntracked == "true") {
            let untrackedFilesList = shell.exec(`git ls-files -o --exclude-standard `);

            if (untrackedFilesList.length > 0) {
                this.ux.log(`List of untracked files to deploy:\n${untrackedFilesList}`);
    
                let untrackedFilesListArr = untrackedFilesList.split('\n');
        
                untrackedFilesListArr.forEach(element => {
                    filesListArr.push(element);
                });
    
                this.ux.log(`File list including untracked files \n ${filesListArr}`);
            }    
        }

        let numFiles = 0;
        // iterate through file list and copy to the output folder
        filesListArr.forEach(element => {
            let dest = this.flags.output + '/' + this.flags.projectfolder + '/' + element.substring(0, element.lastIndexOf("/")).replace('force-app', this.flags.output).replace('"', '');
            if (dest != '' && element != '') {
                shell.mkdir('-p', dest);
                if (element.includes("/classes") || element.includes("/triggers") || element.includes("/pages") || element.includes("/components")) {
                    let fn = element.replace('-meta.xml', '');
                    results[numResults++] = shell.cp('-r', fn.replace('main/', this.flags.projectfolder + '/main/'), dest);
                    results[numResults++] = shell.cp('-r', fn.replace('main/', this.flags.projectfolder + '/main/') + '-meta.xml', dest);
                } else {
                    results[numResults++] = shell.cp('-r', element.replace('main/', this.flags.projectfolder + '/main/'), dest);
                }
                numFiles++;
            }
        });

        // if there are files and no errors, then deploy
        this.ux.log(`Deploying`);
        this.ux.log(`=========`);
        if (this.flags.validateonly) {
            results[numResults++] = shell.exec(`sfdx force:source:deploy -c -p "${this.flags.output}" -u ${this.flags.targetusername} -l ${this.flags.testlevel} --loglevel=debug --verbose -w 60`);
        } else {
            results[numResults++] = shell.exec(`sfdx force:source:deploy -p "${this.flags.output}" -u ${this.flags.targetusername} -l ${this.flags.testlevel} --loglevel=debug --verbose -w 60`);
        }

        if (!results[numResults - 1].stderr) this.ux.log(`Deployed succesfully ${numFiles} files`);
        // Return an object to be displayed with --json
        return results[numResults - 1];
    }
}
