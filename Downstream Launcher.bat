@echo off

echo Welcome to downstream, easly download Microsoft Stream videos
echo.
echo Project originally based on https://github.com/snobu/destreamer
echo Fork powered by @sup3rgiu (https://github.com/sup3rgiu/PoliDown), further adaptation by @stignarnia
echo.

if exist settings.bat (
	goto BEGIN
)

echo It's the first time you use this program, let's set it up
echo Enter your username (e.g. name.surname@example.com)
set /p streamusername=
echo set streamusername=%streamusername%>settings.bat
echo Enter your password
set /p password=
echo set password=%password%>>settings.bat
echo if you need to download multiple videos at a time, enter the name of a file where you have all the links,
echo otherwise you will be prompted for a link every time
set /p urls_file_path=
echo set urls_file_path=%urls_file_path%>>settings.bat
echo set the folder where you want the videos to be downloaded (by default it is a videos subfolder in the installation folder)
set /p output_folder_path=
echo set output_folder_path=%output_folder_path%>>settings.bat
echo set the quality of the downloaded videos [0-5], otherwise you will be asked every time
set /p quality_number=
echo set quality_number=%quality_number%>>settings.bat

:BEGIN
echo To repeat the setup just delete the settings.bat file in the installation folder, or manually change the settings in there
call settings.bat

set command=downstream.js -u %streamusername% -p %password%

if "%urls_file_path%"=="" (
	echo Enter the link to the video you want to download & set /p url=
) else (
	set command=%command% -f %urls_file_path% & goto CONTINUE
)
set command=%command% -v %url%

:CONTINUE
if not "%output_folder_path%"=="" (
	set command=%command% -o %output_folder_path%
)
if not "%quality_number%"=="" (
	set command=%command% -q %quality_number%
)

node %command%

@echo.
@echo Press any key to terminate . . .
@pause >nul
