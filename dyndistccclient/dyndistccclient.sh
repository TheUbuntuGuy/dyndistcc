#!/bin/bash

VERSION="0.0.1"

function printVersion ()
{
    echo "dyndistcc Version $VERSION"
    echo "Copyright 2016 Mark Furneaux, Romaco Canada"
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
}


if [ $# -ne 1 ]; then
    printHelp
else
    case $1 in
        "install")
            mode="1"
            echo "Installing..."
            ;;
        "uninstall")
            mode="2"
            echo "Uninstalling..."
            ;;
        *)
            echo "Invalid command: $1"
            echo ""
            printHelp
    esac
fi



