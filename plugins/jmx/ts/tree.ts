/// <reference path="jmxPlugin.ts"/>
/// <reference path="treeHelpers.ts"/>
namespace Jmx {

  _module.controller("Jmx.TreeHeaderController", ["$scope", ($scope) => {
    // TODO: the tree should ideally be initialised synchronously
    const tree = () => (<any>$('#jmxtree')).treeview(true);

    $scope.expandAll = () => tree().expandAll({ silent: true });
    $scope.contractAll = () => tree().collapseAll({ silent: true });

    const search = _.debounce(filter => {
      const result = tree().search(filter, {
        ignoreCase: true,
        exactMatch: false,
        revealResults: true
      });
      $scope.result.length = 0;
      $scope.result.push(...result);
      Core.$apply($scope);
    }, 300, { leading: false, trailing: true });

    $scope.filter = '';
    $scope.result = [];
    $scope.$watch('filter', (filter, previous) => {
      if (filter !== previous) {
        search(filter);
      }
    });
  }]);

  _module.controller('Jmx.TreeController', ['$scope', '$location', 'workspace', '$route',
    ($scope: ng.IScope, $location: ng.ILocationService, workspace: Workspace, $route: angular.route.IRouteService) => {

    $scope.$on('$destroy', () => {
      const tree = (<any>$('#jmxtree')).treeview(true);
      tree.clearSearch();
      // Bootstrap tree view leaks the node elements into the data structure
      // so let's clean this up when the user leaves the view
      const cleanTreeFolder = (node: Folder) => {
        delete node['$el'];
        if (node.nodes) node.nodes.forEach(cleanTreeFolder);
      };
      cleanTreeFolder(workspace.tree);
      // Then call the tree clean-up method
      tree.remove();
    });

    const updateSelectionFromURL = () => updateTreeSelectionFromURL($location, $('#jmxtree'));

    const populateTree = () => {
      enableTree($scope, $location, workspace, $('#jmxtree'), workspace.tree.children);
      setTimeout(updateSelectionFromURL, 50);
    };

    $scope.$on('jmxTreeUpdated', populateTree);
    populateTree();
  }]);
}
