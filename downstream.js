"use strict";

const execSync = require('child_process').execSync;
const puppeteer = require("puppeteer");
const term = require("terminal-kit").terminal;
const fs = require("fs");
var https = require('https');
const url = require('url');
const path = require("path");
const yargs = require("yargs");
var m3u8Parser = require("m3u8-parser");
const request = require('request');
const notifier = require('node-notifier');

const argv = yargs.options({
    v: { alias: 'videoUrls', type: 'array', demandOption: false },
    f: { alias: 'videoUrlsFile', type: 'string', demandOption: false, describe: 'Path to txt file containing the URLs (one URL for each line)'},
    u: { alias: 'username', type: 'string', demandOption: true, describe: 'Username (e.g. name.surname@st.hunimed.eu)' },
    p: { alias: 'streampassword', type: 'string', demandOption: true },
    o: { alias: 'outputDirectory', type: 'string', default: 'videos' },
    q: { alias: 'quality', type: 'number', demandOption: false, describe: 'Video Quality [0-5]'},
})
.help('h')
.alias('h', 'help')
.example('node $0 -u USERNAME -p PASSWORD -v "https://web.microsoftstream.com/video/9611baf5-b12e-4782-82fb-b2gf68c05adc"\n', "Standard usage")
.example('node $0 -u USERNAME -p PASSWORD -f URLsList.txt\n', "Standard usage")
.example('node $0 -u USERNAME -p PASSWORD -v "https://web.microsoftstream.com/video/9611baf5-b12e-4782-82fb-b2gf68c05adc" "https://web.microsoftstream.com/video/6711baa5-c56e-4782-82fb-c2ho68c05zde"\n', "Multiple videos download")
.example('node $0 -u USERNAME -p PASSWORD -v "https://web.microsoftstream.com/video/9611baf5-b12e-4782-82fb-b2gf68c05adc" -q 4\n', "Define default quality download to avoid manual prompt")
.example('node $0 -u USERNAME -p PASSWORD -v "https://web.microsoftstream.com/video/9611baf5-b12e-4782-82fb-b2gf68c05adc" -o "C:\\Lessons\\Videos"\n', "Define output directory (absoulte o relative path)")
.argv;

function sanityChecks() {
    try {
        const aria2Ver = execSync('aria2c --version').toString().split('\n')[0];
        term.green(`Using ${aria2Ver}\n`);
    }
    catch (e) {
        term.red('You need aria2c in $PATH for this to work. Make sure it is a relatively recent one.');
        process.exit(22);
    }
    try {
        const ffmpegVer = execSync('ffmpeg -version').toString().split('\n')[0];
        term.green(`Using ${ffmpegVer}\n\n`);
    }
    catch (e) {
        term.red('FFmpeg is missing. You need a fairly recent release of FFmpeg in $PATH.');
        process.exit(23);
    }
    if (argv.videoUrls === undefined && argv.videoUrlsFile === undefined) {
        term.red("Missing URLs arguments.\n");
        process.exit();
    }
    if (argv.videoUrls !== undefined && argv.videoUrlsFile !== undefined) {
        term.red("Can't get URLs from both argument.\n");
        process.exit();
    }
    if (argv.videoUrlsFile !== undefined)
        argv.videoUrls = argv.videoUrlsFile; // merge argument

    if (!fs.existsSync(argv.outputDirectory)) {
        if (path.isAbsolute(argv.outputDirectory) || argv.outputDirectory[0] == '~') console.log('Creating output directory: ' + argv.outputDirectory);
        else console.log('Creating output directory: ' + process.cwd() + path.sep + argv.outputDirectory);
        try {
          fs.mkdirSync(argv.outputDirectory, { recursive: true }); // use native API for nested directory. No recursive function needed, but compatible only with node v10 or later
        } catch (e) {
          term.red("Can not create nested directories. Node v10 or later is required\n");
          process.exit();
        }
    }
}

function readFileToArray(path) {
    path = path.substr(1,path.length-2);
	if (process.platform === "win32") //check OS
		return fs.readFileSync(path).toString('utf-8').split('\r\n'); //Windows procedure
	return fs.readFileSync(path).toString('utf-8').split('\n'); //Bash procedure
}

function parseVideoUrls(videoUrls) {
    let stringVideoUrls = JSON.stringify(videoUrls);
    if (stringVideoUrls.substr(stringVideoUrls.length-5) == ".txt\"") // is path?
        return readFileToArray(stringVideoUrls);
    return videoUrls;
}

const notDownloaded = []; // take trace of not downloaded videos

async function downloadVideo(videoUrls, username, streampassword, outputDirectory) {
	
   console.log('Launching headless Chrome to perform the OpenID Connect dance...');
   const browser = await puppeteer.launch({
       // Switch to false if you need to login interactively
       headless: true,
       args: ['--disable-dev-shm-usage', '--lang=it-IT']
   });

   const page = await browser.newPage();
   console.log('Navigating to Microsoft login page...');
   await page.goto('https://web.microsoftstream.com/', { waitUntil: 'networkidle2' });
   await page.waitForSelector('input[type="email"]');
   await page.keyboard.type(username);
   await page.click('input[type="submit"]');

   await sleep(2000);
   await page.keyboard.type(streampassword); // types the password
   await page.click('input[type="submit"]');

   try {
     await page.waitForSelector('input[id="idBtn_Back"]', { timeout: 2000 });
     await page.click('input[id="idBtn_Back"]'); // don't remember me
   } catch (error) {
      // button didn't appear, ok...
   }

   try {
     await browser.waitForTarget(target => target.url().startsWith('https://web.microsoftstream.com'), { timeout: 30000 });
   } catch {
     term.red('Bad username and/or password');
     process.exit(401);
   }
   console.log('We are logged in. ');
   await sleep (3000);
   const cookie = await extractCookies(page);
   console.log('Got required authentication cookies.');
   console.log("\nAt this point Chrome's job is done, shutting it down...");
   await browser.close(); // browser is no longer required. Free up RAM!
    for (let videoUrl of videoUrls) {
       if (videoUrl == "") continue; // jump empty url
       term.green(`\nStart downloading video: ${videoUrl}\n`);

	   try {
         var videoID = videoUrl.substring(videoUrl.indexOf("/video/")+7, videoUrl.length).substring(0, 36); // use the video id (36 character after '/video/') as temp dir name
         var full_tmp_dir = path.join(argv.outputDirectory, videoID);

         var headers = {
             'Cookie': cookie
         };

         var options = {
             url: 'https://euwe-1.api.microsoftstream.com/api/videos/'+videoID+'?api-version=1.0-private',
             headers: headers
         };
         var response = await doRequest(options);
	   } catch (e) {
	     term.red('\nUndefined URL request response. Going to the next one.\n');
         notDownloaded.push(videoUrl);
         continue;
	   }
       const obj = JSON.parse(response);

       if(obj.hasOwnProperty('error')) {
         let errorMsg = ''
         if(obj.error.code === 'Forbidden') {
           errorMsg = 'You are not authorized to access this video.\n'
         } else {
           errorMsg = '\nError downloading this video.\n'
         }
         term.red(errorMsg)
         notDownloaded.push(videoUrl);
         continue;
       }

       // creates tmp dir
       if (!fs.existsSync(full_tmp_dir)) {
           fs.mkdirSync(full_tmp_dir);
       } else {
           rmDir(full_tmp_dir);
           fs.mkdirSync(full_tmp_dir);
       }

       var title = (obj.name).trim();
       console.log(`\nVideo title is: ${title}`);
       title = title.replace(/[/\\?%*:;|"<>]/g, '-'); // remove illegal characters
       var isoDate = obj.publishedDate;
       if (isoDate !== null && isoDate !== '') {
          let date = new Date(isoDate);
          let year = date.getFullYear();
          let month = date.getMonth()+1;
          let dt = date.getDate();

          if (dt < 10) {
            dt = '0' + dt;
          }
            if (month < 10) {
            month = '0' + month;
          }
          let uploadDate = year + '_' + month + '_' + dt;
          title = 'Lesson ' + uploadDate + ' - ' + title;
       } else {
            // console.log("no upload date found");
       }

	  try {
        let playbackUrls = obj.playbackUrls
        var hlsUrl = ''
        for(var elem in playbackUrls) {
            if(playbackUrls[elem]['mimeType'] === 'application/vnd.apple.mpegurl') {
              var u = url.parse(playbackUrls[elem]['playbackUrl'], true);
              hlsUrl = u.query.playbackurl
              break;
            }
        }

        var options = {
            url: hlsUrl,
        };
        var response = await doRequest(options);
		} catch (e) {
	      term.red('\nCan\'t get current video HLS-URL. Going to the next one.\n');
          notDownloaded.push(videoUrl);
	      rmDir(full_tmp_dir);
          continue;
	    }
        var parser = new m3u8Parser.Parser();
        parser.push(response);
        parser.end();
        var parsedManifest = parser.manifest;

        var playlistsInfo = {};
        var question = '';
        var count = 0;
        var audioObj = null;
        var videoObj = null;
        for (var i=0 ; i<parsedManifest['playlists'].length ; i++) {
            if(parsedManifest['playlists'][i]['attributes'].hasOwnProperty('RESOLUTION')) {
                playlistsInfo[i] = {};
                playlistsInfo[i]['resolution'] =  parsedManifest['playlists'][i]['attributes']['RESOLUTION']['width'] + 'x' + parsedManifest['playlists'][i]['attributes']['RESOLUTION']['height'];
                playlistsInfo[i]['uri'] = parsedManifest['playlists'][i]['uri'];
                question = question + '[' + i + '] ' +  playlistsInfo[i]['resolution'] + '\n';
                count = count + 1;
            } else {
                 // if "RESOLUTION" key doesn't exist, means the current playlist is the audio playlist
                 // fix this for multiple audio tracks
                audioObj = parsedManifest['playlists'][i];
            }
        }
        //  if quality is passed as argument use that, otherwise prompt
        if (typeof argv.quality === 'undefined') {
            question = question + 'Choose the desired resolution: ';
            var res_choice = await promptResChoice(question, count);
        }
        else {
          if(argv.quality < 0 || argv.quality > count-1) {
            term.yellow(`Desired quality is not available for this video (available range: 0-${count-1})\nI'm going to use the best resolution available: ${playlistsInfo[count-1]['resolution']}\n`);
            var res_choice = count-1;
          }
          else {
            var res_choice = argv.quality;
            term.yellow(`Selected resolution: ${playlistsInfo[res_choice]['resolution']}\n`);
          }
        }

        videoObj = playlistsInfo[res_choice];

        const basePlaylistsUrl = hlsUrl.substring(0, hlsUrl.lastIndexOf("/") + 1);

        // **** VIDEO ****
		try {
          var videoLink = basePlaylistsUrl + videoObj['uri'];

          var headers = {
              'Cookie': cookie
          };
          var options = {
              url: videoLink,
              headers: headers
          };

        // *** Get protection key (same key for video and audio segments) ***
          var response = await doRequest(options);
		} catch (e) {
	      term.red('\nCan\'t get video playlist-base of the current URL. Going to the next one.\n');
          notDownloaded.push(videoUrl);
	      rmDir(full_tmp_dir);
          continue;
	    }
		try {
          var parser = new m3u8Parser.Parser();
          parser.push(response);
          parser.end();
          var parsedManifest = parser.manifest;
          var keyUri = parsedManifest['segments'][0]['key']['uri'];
          var options = {
            url: keyUri,
            headers: headers,
            encoding: null
          };
          const key = await doRequest(options);

          var keyReplacement = '';
          if (path.isAbsolute(full_tmp_dir) || full_tmp_dir[0] == '~') { // absolute path
              var local_key_path = path.join(full_tmp_dir, 'my.key');
          }
          else {
              var local_key_path = path.join(process.cwd(), full_tmp_dir, 'my.key'); // requires absolute path in order to replace the URI inside the m3u8 file
          }
          fs.writeFileSync(local_key_path, key);
          if(process.platform === 'win32') {
            keyReplacement = await 'file:' + local_key_path.replace(/\\/g, '/');
          } else {
            keyReplacement = 'file://' + local_key_path;
          }
		} catch (e) {
	      term.red('\nCan\'t get current playlist protection key. Going to the next URL.\n');
          notDownloaded.push(videoUrl);
	      rmDir(full_tmp_dir);
          continue;
	    }


        // creates two m3u8 files:
        // - video_full.m3u8: to download all segements (replacing realtive segements path with absolute remote url)
        // - video_tmp.m3u8: used by ffmpeg to merge all downloaded segements (in this one we replace the remote key URI with the absoulte local path of the key downloaded above)
        var baseUri = videoLink.substring(0, videoLink.lastIndexOf("/") + 1);
        var video_full = await response.replace(new RegExp('Fragments', 'g'), baseUri+'Fragments'); // local path to full remote url path
        var video_tmp = await response.replace(keyUri, keyReplacement); // remote URI to local abasolute path
        var video_tmp = await video_tmp.replace(new RegExp('Fragments', 'g'), 'video_segments/Fragments');
        const video_full_path = path.join(full_tmp_dir, 'video_full.m3u8');
        const video_tmp_path = path.join(full_tmp_dir, 'video_tmp.m3u8');
        const video_segments_path = path.join(full_tmp_dir, 'video_segments');
        let times = 5;
        count = 0;
        while (count < times) {// make aria2 multithreading download more consistent and reliable
          try {
            fs.writeFileSync(video_full_path, video_full);
            fs.writeFileSync(video_tmp_path, video_tmp);

            // download async. I'm Speed
            var aria2cCmd = 'aria2c -i "' + video_full_path + '" -j 16 -x 16 -d "' + video_segments_path + '" --header="Cookie:' + cookie + '"';
            var result = execSync(aria2cCmd, { stdio: 'inherit' });
          } catch (e) {
            term.green('\n\nOops! We lost some video fragment! Trying one more time...\n\n');
            rmDir(video_segments_path);
	        fs.unlinkSync(video_tmp_path);
	        fs.unlinkSync(video_full_path);
            count++;
            continue;
          }
          break;
        }
        if (count==times) {
          term.red('\nPersistent errors during the download of the current video. Going to the next one.\n');
          notDownloaded.push(videoUrl);
          continue;
        }

        // **** AUDIO ****
		try {
          var audioLink = basePlaylistsUrl + audioObj['uri'];
          var options = {
              url: audioLink,
              headers: headers
          };

        // same as above but for audio segements
        var response = await doRequest(options);
		} catch (e) {
	      term.red('\nCan\'t get audio playlist-base of the current URL. Going to the next one.\n');
          notDownloaded.push(videoUrl);
	      rmDir(full_tmp_dir);
          continue;
	    }
        var baseUri = audioLink.substring(0, audioLink.lastIndexOf("/") + 1);
        var audio_full = await response.replace(new RegExp('Fragments', 'g'), baseUri+'Fragments');
        var audio_tmp = await response.replace(keyUri, keyReplacement);
        var audio_tmp = await audio_tmp.replace(new RegExp('Fragments', 'g'), 'audio_segments/Fragments');
        const audio_full_path = path.join(full_tmp_dir, 'audio_full.m3u8');
        const audio_tmp_path = path.join(full_tmp_dir, 'audio_tmp.m3u8');
        const audio_segments_path = path.join(full_tmp_dir, 'audio_segments');
        count = 0;
        while (count < times) {// make aria2 multithreading download more consistent and reliable
          try {
            fs.writeFileSync(audio_full_path, audio_full);
            fs.writeFileSync(audio_tmp_path, audio_tmp);

            var aria2cCmd = 'aria2c -i "' + audio_full_path + '" -j 16 -x 16 -d "' + audio_segments_path + '" --header="Cookie:' + cookie + '"';
            var result = execSync(aria2cCmd, { stdio: 'inherit' });
          } catch (e) {
	        term.green('\n\nOops! We lost some audio fragment! Trying one more time...\n\n');
	        rmDir(audio_segments_path);
	        fs.unlinkSync(audio_tmp_path);
	        fs.unlinkSync(audio_full_path);
            count++;
            continue;
          }
          break;
        }
        if (count==times) {
          term.red('\nPersistent errors during the download of the current video. Going to the next one.\n');
          notDownloaded.push(videoUrl);
		  rmDir(full_tmp_dir);
          continue;
        }

        // *** MERGE audio and video segements in an mp4 file ***
        if (fs.existsSync(path.join(outputDirectory, title+'.mp4'))) {
            title = title + '-' + Date.now('nano');
        }

        // stupid Windows. Need to find a better way
        var ffmpegCmd = '';
        var ffmpegOpts = {stdio: 'inherit'};
        if(process.platform === 'win32') {
            ffmpegOpts['cwd'] = full_tmp_dir; // change working directory on windows, otherwise ffmpeg doesn't find the segements (relative paths problem, again, stupid windows. Or stupid me?)
            var outputFullPath = '';
            if (path.isAbsolute(outputDirectory) || outputDirectory[0] == '~')
              outputFullPath = path.join(outputDirectory, title);
            else
              outputFullPath = path.join('..', '..', outputDirectory, title);
            var ffmpegCmd = 'ffmpeg -protocol_whitelist file,http,https,tcp,tls,crypto,data -allowed_extensions ALL -i ' + 'audio_tmp.m3u8' + ' -protocol_whitelist file,http,https,tcp,tls,crypto,data -allowed_extensions ALL -i ' + 'video_tmp.m3u8' + ' -async 1 -c copy -bsf:a aac_adtstoasc -n "' + outputFullPath + '.mp4"';
        } else {
            var ffmpegCmd = 'ffmpeg -protocol_whitelist file,http,https,tcp,tls,crypto -allowed_extensions ALL -i "' + audio_tmp_path + '" -protocol_whitelist file,http,https,tcp,tls,crypto -allowed_extensions ALL -i "' + video_tmp_path + '" -async 1 -c copy -bsf:a aac_adtstoasc -n "' + path.join(outputDirectory, title) + '.mp4"';
        }

        var result = execSync(ffmpegCmd, ffmpegOpts);

        // remove tmp dir
        rmDir(full_tmp_dir);


    }

    if (notDownloaded.length > 0) console.log('\nThese videos have not been downloaded: %s\n', notDownloaded);
    else console.log("\nAll requested videos have been downloaded!\n");
    term.green(`Done!\n`);
	require('node-notifier').notify({
	title: 'Downstream',
	message: 'DONE! See logs on terminal.',
	appID: "https://nodejs.org/", // Such a smart assignment to avoid SnoreToast start menu link. Don't say to my mother.
	}, function(error, response) {/*console.log(response);*/});

}

function doRequest(options) {
  return new Promise(function (resolve, reject) {
    request(options, function (error, res, body) {
      if (!error && (res.statusCode == 200 || res.statusCode == 403)) {
        resolve(body);
      } else {
        reject(error);
      }
    });
  });
}

function promptResChoice(question, count) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
     output: process.stdout
  });

  return new Promise(function(resolve, reject) {
    var ask = function() {
      rl.question(question, function(answer) {
          if (!isNaN(answer) && parseInt(answer) < count && parseInt(answer) >= 0) {
            resolve(parseInt(answer), reject);
            rl.close();
          } else {
            console.log("\n* Wrong * - Please enter a number between 0 and " + (count-1) + "\n");
            ask();
        }
      });
    };
    ask();
  });
}

function rmDir(dir, rmSelf) {
    var files;
    rmSelf = (rmSelf === undefined) ? true : rmSelf;
    dir = dir + "/";
    try { files = fs.readdirSync(dir); } catch (e) { console.log("!Oops, directory not exist."); return; }
    if (files.length > 0) {
        files.forEach(function(x, i) {
            if (fs.statSync(dir + x).isDirectory()) {
                rmDir(dir + x);
            } else {
                fs.unlinkSync(dir + x);
            }
        });
    }
    if (rmSelf) {
        // check if caller wants to delete the directory or just the files in this directory
        fs.rmdirSync(dir);
    }
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractCookies(page) {
    var jar = await page.cookies("https://.api.microsoftstream.com");
    var authzCookie = jar.filter(c => c.name === 'Authorization_Api')[0];
    var sigCookie = jar.filter(c => c.name === 'Signature_Api')[0];
    if (authzCookie == null || sigCookie == null) {
        await sleep(5000);
        var jar = await page.cookies("https://.api.microsoftstream.com");
        var authzCookie = jar.filter(c => c.name === 'Authorization_Api')[0];
        var sigCookie = jar.filter(c => c.name === 'Signature_Api')[0];
    }
    if (authzCookie == null || sigCookie == null) {
        console.error('Unable to read cookies. Try launching one more time, this is not an exact science.');
        process.exit(88);
    }
    return `Authorization=${authzCookie.value}; Signature=${sigCookie.value}`;
}

term.brightBlue(`Project originally based on https://github.com/snobu/destreamer\nFork powered by @sup3rgiu (https://github.com/sup3rgiu/PoliDown), further adaptation by @stignarnia\n`);
sanityChecks();
const videoUrls = parseVideoUrls(argv.videoUrls);
console.info('Video URLs: %s', videoUrls);
console.info('Username: %s', argv.username);
//console.info('Password: %s', argv.streampassword);
console.info('Output Directory: %s\n', argv.outputDirectory);
downloadVideo(videoUrls, argv.username, argv.streampassword, argv.outputDirectory);
