# Github Downloader

Utility to download a branch/tag/commit with submodules

## Usage

	Usage: index.js [options]

	Options:

	-h, --help                  output usage information
	-u, --user <name>           GitHub username
	-p, --password <password>   GitHub password
	--repo <username/name/sha>  Repository name including username e.g aptoma/com.aptoma.drfront/master
	--destination <dir>         The directory to download to
	-V, --version               output the version number


## Example

	node index.js -u foo -p bar --repo aptoma/com.aptoma.drfront/master --destination /tmp/download
