(function (global) {
  "use strict";

  var ACTIONS = {
    complete: "new_ConcluirTrocaDeCarro",
    cancel: "new_CancelarTrocaDeCarro",
    revert: "new_ReverterTrocaDeCarro"
  };

  function getFormContext(primaryControl) {
    return primaryControl && typeof primaryControl.getFormContext === "function"
      ? primaryControl.getFormContext()
      : primaryControl;
  }

  function getId(formContext) {
    var id = formContext && formContext.data && formContext.data.entity.getId();
    return (id || "").replace(/[{}]/g, "");
  }

  function open(action, primaryControl) {
    var formContext = getFormContext(primaryControl);
    var id = getId(formContext);
    if (!id) {
      return Xrm.Navigation.openAlertDialog({ text: "Salve a troca antes de executar esta acao." });
    }

    return Xrm.Navigation.navigateTo(
      {
        pageType: "webresource",
        webresourceName: "new_exchange_lifecycle_dialog.html",
        data: encodeURIComponent(JSON.stringify({ action: action, id: id }))
      },
      { target: 2, position: 1, width: { value: 460, unit: "px" }, height: { value: 430, unit: "px" } }
    ).then(function () {
      if (formContext && formContext.data) {
        return formContext.data.refresh(false);
      }
      return null;
    });
  }

  global.BetinhosExchangeLifecycle = {
    concluir: function (primaryControl) { return open(ACTIONS.complete, primaryControl); },
    cancelar: function (primaryControl) { return open(ACTIONS.cancel, primaryControl); },
    reverter: function (primaryControl) { return open(ACTIONS.revert, primaryControl); },
    actions: ACTIONS
  };
}(window));
