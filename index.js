#!/usr/bin/env node
var GitAPI = require('github'),
	request = require('request'),
	fs = require('fs'),
	when = require('when'),
	exec = require('child_process').exec,
	path = require('path'),
	program = require('commander');

program
	.usage('[options]')
	.option('-u, --user <name>', 'GitHub username')
	.option('-p, --password <password>', 'GitHub password')
	.option('--repo <username/name/sha>', 'Repository name including username e.g aptoma/com.aptoma.drfront/master')
	.option('--destination <dir>', 'The directory to download to');

program.parse(process.argv);

if (!program.user || !program.password || !program.repo || !program.destination) {
	console.log('Missing required parameters');
	console.log(program.helpInformation());
	process.exit(1);
}

var repoInfo = program.repo.split('/');
var repo = {
		path: repoInfo[1],
		user: repoInfo[0],
		sha: repoInfo[2]
	},
	username = program.user,
	password = program.password;

var github = new GitAPI({
	version: "3.0.0"
});

github.authenticate({
	type: 'basic',
	username: username,
	password: password
});

var url = 'https://' + username + ':' + password + '@github.com/' + repo.user + '/' + repo.path + '/tarball/' + repo.sha,
	destFile = program.destination + '/' + repo.sha + '.tgz';

downloadFile(url, destFile).then(unpack).then(
	function (dir) {
		fs.unlink(destFile);
		getSubmodules(dir);
	}
);

function getSubmodules(dir) {
	fs.readFile(dir + '/.gitmodules', function (err, data) {
		if (err) {
			die(err);
		}

		var re = /\[submodule "([^"]+)"\][\s\S]+?[^\n]+[\s\S]+?url = git@github.com:([^\/]+)\/([^\.]+)\.git/gm,
			submodules = {};

		while ((matches = re.exec(data)) !== null) {
			submodules[matches[1]] = {
				path: matches[1],
				user: matches[2],
				repo: matches[3]
			};
		}

		if (Object.keys(submodules).length) {
			downloadSubModules(submodules, dir);
		}
	});
}

function downloadSubModules(submodules, destDir) {
	var moveAndClean = function (dir, module) {
		var dfd = when.defer();
		exec('mv ' + dir + '/* ' + destDir + '/' + module.path, function (err, stdout, stderr) {
			if (err) {
				dfd.reject(err);
			}
			fs.rmdir(dir);
			dfd.resolve(dir);
		});
		return dfd.promise;
	};

	github.gitdata.getTree({
		user: repo.user,
		repo: repo.path,
		sha: repo.sha,
		recursive: true
	}, function (err, resp) {
		resp.tree.forEach(function (item) {
			if (submodules[item.path]) {
				var module = submodules[item.path],
					filename = destDir + '/' + item.sha + '.tgz',
					url = 'https://' + username + ':' + password + '@github.com/' + module.user + '/' + module.repo + '/tarball/' + item.sha;

				downloadFile(url, filename).then(unpack).then(
					function (dir) {
						fs.unlink(filename);
						moveAndClean(dir, module);
					},
					die
				);
			}
		});
	});
}

/**
 * Unpack tar gz file in the same folder as the file + /filename folder
 * Note! It will remove the destination folder if it exist.
 *
 * @param  {String} filename full path to the file
 * @return {Object}          Promise/A
 */
function unpack(filename) {
	var dfd = when.defer(),
		destDir = path.dirname(filename) + '/' + path.basename(filename, '.tgz');

	var run = function () {
		exec('tar xzf ' + filename + ' --strip 1 -C ' + destDir, function (err) {
			if (err) {
				return dfd.reject(err);
			}
			dfd.resolve(destDir);
		});
	};

	fs.exists(destDir, function (exists) {
		if (exists) {
			fs.rmdir(destDir, function (err) {
				if (err) {
					die(err);
				}
				console.log('deleted', destDir);
				run();
			});
		} else {
			fs.mkdir(destDir, '0777', function (err) {
				if (err) {
					return die(err);
				}
				run();
			});
		}
	});

	return dfd.promise;
}

/**
 * Download file from url
 * Note! Will delete the filename if it alread exists.
 *
 * @param  {String} url
 * @param  {String} filename full path to the destination file
 * @return {Object}          Promise/A
 */
function downloadFile(url, filename) {
	var deferred = when.defer(),
		destDir = path.dirname(filename);

	console.log('Downloading... ' + filename);

	var fetch = function () {
		request(url).pipe(fs.createWriteStream(filename)).on('close', function () {
			deferred.resolve(filename);
		}).on('error', function (err) {
			deferred.reject(err);
		});
	};

	fs.exists(destDir, function (exists) {
		if (!exists) {
			fs.mkdirSync(destDir, '0777');
		}

		fs.exists(filename, function (exists) {
			if (exists) {
				fs.unlink(filename, function () {
					console.log('deleted', filename);
					fetch();
				});
			} else {
				fetch();
			}
		});
	});

	return deferred.promise;
}

function die() {
	console.log.apply(this, arguments);
	process.exit(1);
}