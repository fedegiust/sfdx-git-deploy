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
        testlevel: flags.string({ char: 'l', description: messages.getMessage('runTestsFlagDescription') })
    };

    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    // Comment this out if your command does not support a hub org username
    protected static supportsDevhubUsername = true;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;

    public async run(): Promise<any> {

        let numResults = 0;
        const results = [];

        if (!shell.which('git')) {
            shell.echo('Sorry, this script requires git');
            shell.exit(1);
        }

        if (this.flags.branch == null) {
            this.ux.log('The local branch you need to compare to is missing ');
            return null;
        }

        if (this.flags.output == null) {
            this.ux.log('The output folder to put the files in is missing ');
            return null;
        }

        if (this.flags.testlevel == null) {
            this.ux.log('The local branch you need to compare to is missing ');
            this.flags.testlevel = 'RunLocalTests';
        }        

        this.ux.log(`Preparing deployment`);
        this.ux.log(`====================`);
        this.ux.log(`Branch to compare: ${this.flags.branch}`);
        this.ux.log(`Path to put the files in: ${this.flags.output}`);
        this.ux.log(`Test level: ${this.flags.testlevel}`);

        this.ux.log(`Comparing local branch against ${this.flags.branch}`);

        shell.config.verbose = false;

        let workingBranch = shell.exec(`git rev-parse --abbrev-ref HEAD`);

        this.ux.log(`Current working branch is : ${workingBranch}`);

        this.ux.log(`Creating outpud dir: ${this.flags.output}`);

        shell.mkdir('-p', this.flags.output);

        let filesList = shell.exec(`git diff --no-renames --diff-filter=d --name-only ${this.flags.branch} ${workingBranch}`);

        this.ux.log(`List of files to deploy:\n${filesList}`);

        let filesListArr = filesList.split('\n');

        let untrackedFilesList = shell.exec(`git ls-files -o --exclude-standard --exclude="*-meta.xml"`);

        this.ux.log(`List of untracked files to deploy:\n${untrackedFilesList}`);

        let untrackedFilesListArr = untrackedFilesList.split('\n');

        untrackedFilesListArr.forEach(element => {
            filesListArr.push(element);
        });

        this.ux.log(`File list ${filesListArr}`);

        let numFiles = 0;
        filesListArr.forEach(element => {
            let dest = element.substring(0, element.lastIndexOf("/")).replace('force-app', this.flags.output);
            if (dest != '') {
                shell.mkdir('-p', dest);
                results[numResults++] = shell.cp('-r', element, dest);
                results[numResults++] = shell.cp('-r', element + '-meta.xml', dest);
                numFiles++;
            }
        });

        if (!results[numResults - 1].stderr) {
            this.ux.log(`Deploying`);
            this.ux.log(`=========`);
            results[numResults++] = shell.exec(`sfdx force:source:deploy -p "${this.flags.output}" -u ${this.flags.targetusername} -l ${this.flags.testlevel}`);
        } else {
            this.ux.log(`Nothing to deploy ${results[numResults - 1].stderr}`);
        }

        if (!results[numResults - 1].stderr) this.ux.log(`Deployed succesfully ${numFiles} files`);
        // Return an object to be displayed with --json
        return results[numResults - 1];
    }
}
