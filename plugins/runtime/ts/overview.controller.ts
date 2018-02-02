/// <reference path="./runtimeExports.ts"/>
module Runtime {



    export interface OverviewControllerScope extends ng.IScope {
        pid: string;
        host: string;
        workingDirectory: string;
        vmArgs: string;
        javaPath: string;
        runtime: Runtime;
        operatingSystem: OperatingSystem;
        classPath: string;
        uptime: String;
        showSummary: boolean;
        showWd: boolean;
        showCmd: boolean;
    }

    function javaPath( runtime: Runtime ) {
        var commandLine = '';
        var javaHome = runtime.SystemProperties['java.home'];
        if ( javaHome ) {
            var fileSeparator = runtime.SystemProperties['file.separator'];
            commandLine += javaHome + fileSeparator + 'bin' + fileSeparator;
        }
        commandLine += 'java ';
        return commandLine;
    }
    function vmArgs( runtime: Runtime ):string {

        var commandLine: string = "";
        for ( var argument in runtime.InputArguments ) {
            commandLine += escapeSpaces( runtime.InputArguments[argument] ) + ' ';
        }
        return commandLine;
    }

    function escapeSpaces( argument: string ):string {
        return argument.replace( / /g, '\\ ' );
    }



    export function RuntimeOverviewController( $scope: OverviewControllerScope, jolokia: Jolokia.IJolokia, workspace: Jmx.Workspace, $location: ng.ILocationService )  {
        'ngInject';

      function render( response ) {
            var mbean: string = response.request.mbean;
            if ( mbean === runtimeMbean ) {
                var runtime: Runtime = response.value;
                $scope.runtime = runtime;
                var regex = /(\d+)@(.+)/g;
                var pidAndHost = regex.exec( runtime.Name );
                $scope.pid = pidAndHost[1];
                $scope.host = pidAndHost[2];
                $scope.javaPath = javaPath( runtime );
                $scope.classPath = escapeSpaces( runtime.ClassPath );
                $scope.vmArgs = vmArgs( runtime );
                $scope.workingDirectory = runtime.SystemProperties['user.dir'];
                $scope.uptime = Core.humanizeMilliseconds( runtime.Uptime );
            } else if ( mbean === osMbean ) {
                $scope.operatingSystem = response.value;
            }
            Core.$apply( $scope );

        }
        $scope.showSummary = true;
        $scope.showWd = true;
        $scope.showCmd = true;
        Core.register( jolokia, $scope, [{
            type: 'read',
            mbean: runtimeMbean,
            arguments: []
        }, {
            type: 'read',
            mbean: osMbean,
            arguments: []
        }], Core.onSuccess( render ) );
 }
}
