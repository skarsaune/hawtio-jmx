///<reference path="./runtimeExports.ts"/> 
module Runtime {
    
    export interface Threading {
        ThreadCount: number;
        PeakThreadCount: number;
    }

    export interface ClassLoading {
        LoadedClassCount: number;
        TotalLoadedClassCount: number;
    }

    export interface OperatingSystem {
        MaxFileDescriptorCount: number;
        OpenFileDescriptorCount: number;
        ProcessCpuLoad: number;
        ProcessCpuTime: number;
        SystemCpuLoad: number;
        FreePhysicalMemorySize: number;
        TotalPhysicalMemorySize: number;
        TotalSwapSpaceSize: number;
        FreeSwapSpaceSize: number;
    }

    export interface SystemProperty {
        name: string;
        value: string;
    }

    export interface Metric {
        index: number;//to prevent default sorting on names alphabetically
        name: string;
        categoryLink: CategoryLink;
        value: any;
        referenceValue: any;
    }

    export interface CategoryLink {
        description: string;
        link: string;
    }

    export interface MbeanHandler {
        mbean: string;
        callback: ( value: any ) => void;
    }

    export interface MetricsControllerScope extends ng.IScope {
        tableConfig: any;
        tableDtOptions: any;
        tableColumns: Array<any>;
        threading: Threading;
        operatingSystem: OperatingSystem;
        heapUsage: MemoryUsage;
        classLoading: ClassLoading;
        classPath: string;
        updaters: { [index: string]: ( any ) => void };
        metrics: Array<Metric>;
        garbageCollectors: { [index: string]: GarbageCollector };
    }

    export interface MemoryUsage {
        used: number;
        max: number;
        init: number;
        committed: number;
    }

    interface Memory {
        HeapMemoryUsage: MemoryUsage;
    }

    export interface GarbageCollector {
        Name: string;
        CollectionCount: number;
        CollectionTime: number;
    }


    function deriveMetrics( scope: MetricsControllerScope, filter: ng.IFilterService ) {

        function toPercentage( value: number ):string {
            return filter( "number" )( value * 100.0, 2 ) + '%';
        }

        function withSpaceAsThousandSeparator( value: number ):string {
            var firstString: string = '' + value;
            var formatted: string = '';
            for ( var i = 0; i < firstString.length; i++ ) {
                var character = firstString.charAt( i );
                if ( ( firstString.length - i ) % 3 == 0 ) {
                    formatted += ' ';
                }
                formatted += character;
            }
            return formatted;
        }

        function separatedAndWithPercent( value: number, referenceValue: number ):string {
            var result = withSpaceAsThousandSeparator( value );
            result += ' (';
            result += toPercentage( 1.0 * value / referenceValue );
            result += ')';
            return result;
        }

        var newMetrics: Array<Metric> = [];
        var index = 1;

        if ( scope.operatingSystem ) {
            var osLink = 'jmx/attributes?nid=root-java.lang-OperatingSystem';
            newMetrics.push( { index: index++, name: 'File descriptors (open/max)', categoryLink: {description: 'OS', link: osLink}, value: withSpaceAsThousandSeparator( scope.operatingSystem.OpenFileDescriptorCount ), referenceValue: withSpaceAsThousandSeparator( scope.operatingSystem.MaxFileDescriptorCount ) });
            newMetrics.push( { index: index++, name: 'System CPU load', categoryLink: {description: 'OS', link: osLink}, value: toPercentage( scope.operatingSystem.SystemCpuLoad ), referenceValue: '' });
            newMetrics.push( {
                index: index++, name: 'Physical memory (free/total)', categoryLink: {description: 'OS', link: osLink},
                value: separatedAndWithPercent( scope.operatingSystem.FreePhysicalMemorySize, scope.operatingSystem.TotalPhysicalMemorySize ),
                referenceValue: withSpaceAsThousandSeparator( scope.operatingSystem.TotalPhysicalMemorySize )
            });

            newMetrics.push( {
                index: index++, name: 'Swap memory space (free/total)', categoryLink: {description: 'OS', link: osLink},
                value: separatedAndWithPercent( scope.operatingSystem.FreeSwapSpaceSize, scope.operatingSystem.TotalSwapSpaceSize ),
                referenceValue: withSpaceAsThousandSeparator( scope.operatingSystem.TotalSwapSpaceSize )
            });

            newMetrics.push( {
                index: index++, name: 'Process CPU (load/time)', categoryLink: {description: 'OS', link: osLink},
                value: toPercentage( scope.operatingSystem.ProcessCpuLoad ),
                referenceValue: Core.humanizeMilliseconds( scope.operatingSystem.ProcessCpuTime / 1000000 )
            });

        }

        if ( scope.heapUsage ) {
            newMetrics.push( {
                index: index++, name: 'Heap usage (used/max)', categoryLink: {description: 'OS', link: osLink},
                value: separatedAndWithPercent( scope.heapUsage.used, scope.heapUsage.max ),
                referenceValue: withSpaceAsThousandSeparator( scope.heapUsage.max )
            });
        }

        if ( scope.threading ) {
            newMetrics.push( {
                index: index++, name: 'Thread count (current/peak)', categoryLink: {description: 'Threads', link: 'threads'},
                value: scope.threading.ThreadCount, referenceValue: scope.threading.PeakThreadCount
            });
        }

        if ( scope.classLoading ) {
            newMetrics.push( {
                index: index++, name: 'Classes loaded (current/peak)', categoryLink: {description: 'Code', link: 'diagnostics/heap'},
                value: withSpaceAsThousandSeparator( scope.classLoading.LoadedClassCount ),
                referenceValue: withSpaceAsThousandSeparator( scope.classLoading.TotalLoadedClassCount )
            });
        }

        for ( var name in scope.garbageCollectors ) {
            var garbageCollector: GarbageCollector = scope.garbageCollectors[name];
            newMetrics.push( {
                index: index++, name: garbageCollector.Name + ' (collections/time)', categoryLink: {description: 'GC', link: 'jmx/attributes?nid=root-java.lang-GarbageCollector'},
                value: garbageCollector.CollectionCount, referenceValue: withSpaceAsThousandSeparator( garbageCollector.CollectionTime ) + " ms"
            });
        }
        return newMetrics;
    }

    export function RuntimeMetricsController( $scope: MetricsControllerScope, jolokia: Jolokia.IJolokia, workspace: Jmx.Workspace, $filter ) {
        'ngInject';
        function render( response ) {
            var mbean = response.request.mbean;
            var updater = $scope.updaters[mbean];
            if ( updater ) {
                updater( response.value );
            }
            if ( mbean = 'java.lang:type=Memory' ) { //the last response
                $scope.metrics = deriveMetrics( $scope, $filter );
                Core.$apply( $scope );
            }
        }
        $scope.updaters = {};
        $scope.garbageCollectors = {};
        $scope.updaters['java.lang:type=Threading'] = ( threading: Threading ) => { $scope.threading = threading };
        $scope.updaters['java.lang:type=OperatingSystem'] = ( operatingSystem: OperatingSystem ) => { $scope.operatingSystem = operatingSystem; };
        $scope.updaters['java.lang:type=ClassLoading'] = ( classLoading: ClassLoading ) => { $scope.classLoading = classLoading; };
        //find garbage collectors (if any in JMX tree and set up for metrics calculation)
        if ( workspace.tree ) {
            var collectors = workspace.tree.get( 'java.lang' ).get('GarbageCollector');
            if ( collectors && collectors.children ) {
                for ( var i = 0; i < collectors.children.length; i++ ) {
                    var collector = collectors.children[i];
                    var mbeanKey = '' + collector.domain + ':type=' + collector.entries['type'] + ',name=' + collector.entries['name'];
                    $scope.updaters[mbeanKey] = ( garbageCollector: GarbageCollector ) => { $scope.garbageCollectors[garbageCollector.Name] = garbageCollector; };
                }
            }
        }
        $scope.updaters['java.lang:type=Memory'] = ( memory: Memory ) => { $scope.heapUsage = memory.HeapMemoryUsage };
        var requests = [];
        for ( var mbean in $scope.updaters ) {
            requests.push( {
                type: 'read',
                mbean: mbean,
                arguments: []
            });
        }

    $scope.tableConfig = {
      selectionMatchProp: 'name',
      showCheckboxes: false
    };

    $scope.tableDtOptions = {
      order: [[0, "asc"]]
    };


    $scope.tableColumns = [
      {
        header: '#',
        itemField: 'index',
      },
      {
        header: 'Metric',
        itemField: 'name',
      },

      {
          itemField: 'categoryLink',
          header: 'Category',
          templateFn: value => `<div class="ngCellText ng-binding" title="${value.description}"><a href="${value.link}">${value.description}</a></div>`
      },
{
          itemField: 'value',
          header: 'Value',
          templateFn: value => `<div class="align-right ngCellText ng-binding" title="${value}">${value}</div>`
      },
{
          itemField: 'referenceValue',
          header: '',
          templateFn: value => `<div class="align-right ngCellText ng-binding" title="${value}">${value}</div>`
      }


    ];
//<div class="ngCellText ng-binding" title="row.entity.category"><a href="{{row.entity.link}}">{{row.entity.category}}</a></div>

        Core.register( jolokia, $scope, requests, Core.onSuccess( render ) );
    }
}