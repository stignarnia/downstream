# Downstream (Deprecated)

Both my university and my friend's for whom I did this modification have moved on from using this system, thus I have no way of testing that this still works and in fact it probably doesn't. Obviously this also means it won't be maintained and will be put in the public archive.

## Saves Microsoft Stream videos

This project was originally based on [Destreamer](https://github.com/snobu/destreamer)  
Fork powered by @sup3rgiu (https://github.com/sup3rgiu/PoliDown)  
Further adaptation by @stignarnia

**This program does not work if your school or workplace uses a custom Single Sign On like Shibboleth, in that case give a look at the links above**  
  
**It has been tested in the following schools or workplaces (feel free to add yours if you used this successfully)**
* Humanitas University

## PREREQUISITES
If you don't know what these are just keep reading

* [**Node.js**](https://nodejs.org/it/download/): above v14.0.
* [**aria2**](https://github.com/aria2/aria2/releases): this needs to be in your `$PATH` (for example, copy `aria2c.exe` to `C:\Windows`). PoliDown calls `aria2c` with a bunch of arguments in order to improve the download speed.
* [**ffmpeg**](https://www.ffmpeg.org/download.html): a recent version (year 2019 or above), in [`$PATH`](https://www.thewindowsclub.com/how-to-install-ffmpeg-on-windows-10). Please note that if you have an old version in a folder that is also in `$PATH`, that is the one that will be called, thus generating errors.

## INSTALLATION AND USAGE

* Click on `code`, then `Download ZIP`
* Extract the content in the folder you prefer, we'll call it `installationfolder`

If you are on Windows keep reading, otherwise skip to macOS or Linux

* Follow the tutorial below until the succesful execution of the `npm install` command
* Double click on the `Downstream Launcher.bat` file and enjoy

### Windows tutorial
**N.B:** ffmpeg.zeranoe.com closed since Sep 18, 2020. If you are following the video tutorial, download ffmpeg from another source available on the [ffmpeg website](https://www.ffmpeg.org/download.html) (nightly build is no longer required)

**N.B:** This video was made for [PoliDown](https://github.com/sup3rgiu/PoliDown), ignore everything after the succesful execution of the `npm install` command

***[Tutorial on Youtube](https://www.youtube.com/watch?v=iZgea4t5YW4)***

### macOS (Mojave and above, including Big Sur on M1 (arm64))

* [Install Homebrew](https://www.youtube.com/watch?v=31eTw5xRHBA)
* Give it these two commands:
```
brew install ffmpeg
brew install aria2
```
* [Install Node.js](https://www.youtube.com/watch?v=0i-gstqgjuE)
* Staying in terminal:
```
cd /something/installationfolder/
npm install
```
*  Then, always in terminal, follow the instruction under command line usage

### Linux

Come on, you have Linux, you know how to do this stuff, anyway on Ubuntu (or any Debian based distro I guess), this works:

```
sudo apt-get update
sudo apt-get upgrade
sudo apt-get install nodejs
sudo apt-get install npm
sudo apt-get install ffmpeg
sudo apt-get install aria2
sudo apt-get install libsecret-1-0
cd /something/installationfolder/
npm install
```
Then follow command line usage

### COMMAND LINE USAGE

Default usage:
```
node downstream.js -u USERNAME -p PASSWORD -v "https://web.microsoftstream.com/video/VIDEO-1"
```

Show options:
```
node downstream.js -h

Options:
  --version              Show version number                           [boolean]
  -v, --videoUrls                                                      [array]
  -f, --videoUrlsFile    Path to txt file containing the URLs (one URL for each line) [string]
  -u, --username         name.surname@example.com                 [string] [required]
  -p, --password                                                  [string] [required]
  -o, --outputDirectory                             		[string] [default: "installationfolder/videos"]
  -q, --quality          Video Quality [0-5]                            [number]
  -h, --help             Show help                                     [boolean]
```

Multiple videos download:
```
node downstream.js -u USERNAME -p PASSWORD
    -v "https://web.microsoftstream.com/video/VIDEO-1"
                "https://web.microsoftstream.com/video/VIDEO-2"
                "https://web.microsoftstream.com/video/VIDEO-3"
```

Download from TXT file (one link per line):
```
node downstream.js -u USERNAME -p PASSWORD -f "/my/path/here/links.txt"
```

Define default video quality [0-5] (to avoid manual prompt for each video):
```
node downstream.js -u USERNAME -p PASSWORD -v "https://web.microsoftstream.com/video/VIDEO-1" -q 4
```

Output directory (relative or absoulte path):
```
node downstream.js -u USERNAME -p PASSWORD -v "https://web.microsoftstream.com/video/VIDEO-1" -o "/my/path/here"
```

## EXPECTED OUTPUT

```
Project originally based on https://github.com/snobu/destreamer
Fork powered by @sup3rgiu (https://github.com/sup3rgiu/PoliDown)
Further adaptation by @stignarnia
Using aria2 version ARIA2VERSION
Using ffmpeg version FFMPEGVERSION

Launching headless Chrome to perform the OpenID Connect dance...
Navigating to Microsoft login page...
We are logged in.

Start downloading video: https://web.microsoftstream.com/video/VIDEO-1
Got required authentication cookies.
Looking up AMS stream locator...

Video title is: VIDEOTITLE

[0] 320x180
[1] 480x270
[2] 640x360
[3] 960x540
[4] 1280x720
[5] 1920x1080
Choose the desired resolution: CHOSENRES

dd/mm hh:mm:ss [NOTICE] Downloading ITEMS item(s)

[...]

At this point Chrome's job is done, shutting it down...
Done!
```

The video is now saved under `installationfolder/videos`, or whatever the `outputDirectory` argument points to.
