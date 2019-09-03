sfdx-git-deploy
===============

sfdx plugin to deploy latest changes to sandbox

The idea behind this is to be able to get the files that changed comparing a base branch and deploy to a specified sandbox. 

The local working copy must be tracked in a git repo.

So, let's say we are working on a dev sandbox in a feature branch called XYZ. 
We should be in the root of the project in branch XYZ and we enter this in the command line:

```sfdx git:code:deploy -b master -u devOrgPersonal -d config/deploy```

This would use git diff to compare what changed in branch XYZ against master branch, if there is any changed files it will put them in the specified path (in this case config/deploy) and the use sfdx force:source:deploy to the specified sandbox.

On top of this, it will do a check with git ls-files to get any new untracked file and put them in the same folder. Useful for cases that there is a new file but hasn't been pushed to the repo yet.

To install:

```sfdx plugins:install sfdx-git-deploy```
