#!/bin/bash

VERSION="0.0.1"
SCRIPTFILE="/usr/local/bin/dyndistccsync"
DISTCCCONF="/etc/default/distcc"
DISTCCHOSTS="/etc/distcc/hosts"

function printVersion ()
{
    echo "dyndistcc Version $VERSION"
    echo "Copyright 2016 Mark Furneaux, Romaco Canada"
}

function printRoot ()
{
    echo "This script must be run as root"
}

function printHelp ()
{
    scriptName=$(basename "$0")
    printVersion
    echo "Usage: $scriptName <command>"
    echo ""
    echo "Commands:"
    echo "  install     Install and configure dyndistcc client"
    echo "  uninstall   Remove dyndistcc client"
    echo ""
    printRoot
}

function installScript ()
{
    clientHash=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

    echo "#!/bin/bash" >> $SCRIPTFILE
    echo "SERVERADDRESS=$serverAddr" >> $SCRIPTFILE
    echo "PORTNUMBER=$portNum" >> $SCRIPTFILE
    echo "PROJECTNAME=$projectName" >> $SCRIPTFILE
    echo "DISTCCHOSTS=$DISTCCHOSTS" >> $SCRIPTFILE
    echo "CLIENTHASH=$clientHash" >> $SCRIPTFILE
    echo "USERNAME=$userName" >> $SCRIPTFILE
    cat >> $SCRIPTFILE << ENDOFSCRIPT
wget -O "$DISTCCHOSTS" "http://$SERVERADDRESS:$PORTNUMBER/api/checkin?hash=$CLIENTHASH&project=$PROJECTNAME&username=$USERNAME"
ENDOFSCRIPT

    chmod +x $SCRIPTFILE
}

function askQuestions ()
{
    read -p "What is the domain/IP address of the controller: " serverAddr
    if [ -z "$serverAddr" ]; then
        echo "Empty server address. Aborting installation."
        exit 2
    fi
    read -p "What is the port of the controller [33333]: " portNum
    if [ -z "$portNum" ]; then
        echo "Using port 33333."
        portNum=10
    fi
    read -p "What network segment should we listen on (CIDR notation): " netSegment
    if [ -z "$netSegment" ]; then
        echo "Empty segment name. Aborting installation."
        exit 2
    fi
    read -p "What project is this client part of (already configured on controller): " projectName
    if [ -z "$projectName" ]; then
        echo "Empty project name. Aborting installation."
        exit 2
    fi
    read -p "What is your name (not parsed): " userName
    if [ -z "$userName" ]; then
        echo "Empty user name. Aborting installation."
        exit 2
    fi
    read -p "The nice value for incoming jobs (-20 to 20) [10]: " niceValue
    if [ -z "$niceValue" ]; then
        echo "Using nice of 10."
        niceValue=10
    fi
}

function doInstall ()
{
    askQuestions

    if [ $(which cron | wc -l) -lt 1 ] || [ $(which wget | wc -l) -lt 1 ] || [ $(which sed | wc -l) -lt 1 ]; then
        echo "Installing dependencies..."
        apt-get install cron wget sed
        echo ""
        echo ""
    else
        echo "Dependencies already installed. Skipping..."
    fi

    if [ $(which distcc | wc -l) -lt 1 ]; then
        echo "distcc is missing. Installing..."
        apt-get install distcc
        echo ""
        echo ""
    else
        echo "distcc is already installed..."
    fi

    echo "Configuring distcc..."
    cp $DISTCCCONF "$DISTCCCONF.bak"
    sed -i "/^[^#]*STARTDISTCC=*/c\STARTDISTCC=\"true\"" $DISTCCCONF
    sed -i "/^[^#]*LISTENER=*/c\LISTENER=\"\"" $DISTCCCONF
    sed -i "/^[^#]*ALLOWEDNETS=*/c\ALLOWEDNETS=\"$netSegment\"" $DISTCCCONF
    sed -i "/^[^#]*NICE=*/c\NICE=\"$niceValue\"" $DISTCCCONF

    echo "Installing scripts..."
    installScript

    echo "Writing crontab..."
    CRONTMP=$(mktemp) || exit 1
    crontab -l > $CRONTMP
    if [ ! -s $CRONTMP ]; then
        echo "MAILTO=\"\"" >> $CRONTMP
    fi

    echo "* * * * * $SCRIPTFILE #dyndistccAutoRemove" >> $CRONTMP
    crontab $CRONTMP
    rm $CRONTMP

    echo "Starting distcc..."
    #service distcc restart

    if [ $? -eq 0 ]; then
        echo ""
        SUCCESSMSG="dyndistcc is now running for the $projectName project on the $netSegment network."
        if [ -e "/usr/games/cowsay" ]; then
            /usr/games/cowsay $SUCCESSMSG
        else
            echo $SUCCESSMSG
        fi
    else
        echo ""
        echo "Something went wrong when starting distcc. Things might not work correctly."
    fi
}

function doUninstall ()
{
    echo "Uninstalling..."
    echo "Removing crontab entries..."
    crontab -l | grep --invert-match "#dyndistccAutoRemove" | crontab -
    echo "Removing scripts..."
    rm $SCRIPTFILE
    echo "Reverting distcc settings..."
    cp "$DISTCCCONF.bak" $DISTCCCONF
    echo ""
    echo "Uninstall complete."
}


if [ $# -ne 1 ]; then
    printHelp
elif [ $EUID -ne 0 ]; then
    printRoot
else
    case $1 in
        "install")
            if [ $(crontab -l | grep "#dyndistccAutoRemove" | wc -l) -gt 0 ]; then
                echo "Error. Already installed. Please run uninstall before re-installing."
                exit 3
            fi
            doInstall
            ;;
        "uninstall")
            doUninstall
            ;;
        "-h")
            printHelp
            ;;
        "--help")
            printHelp
            ;;
        *)
            echo "Invalid command: $1"
            echo ""
            printHelp
    esac
fi


