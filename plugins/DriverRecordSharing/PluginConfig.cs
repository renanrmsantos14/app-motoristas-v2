using Microsoft.Crm.Sdk.Messages;

namespace Betinhos.DriverRecordSharing
{
    internal static class PluginConfig
    {
        public const string CreateMessage = "Create";
        public const string UpdateMessage = "Update";
        public const string PreImageAlias = "pre";
        public const string TargetParameterName = "Target";

        public const string ServiceTable = "cr40f_reservadeveculos";
        public const string ServicePrimaryId = "cr40f_reservadeveculosid";
        public const string ServiceDriverLookup = "cr40f_motorista";
        public const string ServiceMaintenanceLookup = "cr40f_om";
        public const string ServiceRequesterLookup = "cr40f_solicitante";
        public const string ServiceStartDate = "cr40f_dataehorriodesada";
        public const string ServiceVehicleLookup = "cr40f_veiculo";
        public const string ServiceVehicleOrigin = "new_origemveiculo";
        public const int ServiceVehicleOriginAutomatic = 100000000;
        public const int ServiceVehicleOriginManual = 100000001;
        public const string ServiceProgrammedFlag = "new_foiprogramado";
        public const string ServiceExchangeLookup = "cr40f_ot";
        public const string ServiceCategory = "new_categoriadoitem";
        public static readonly int[] ServiceBackfillCategories = { 100000000, 100000001 };
        public const int EmployeeBackfillDaysBack = 45;
        public const int ServiceVehicleSyncDaysBack = 1;
        public const int ServiceVehicleSyncDaysAhead = 90;

        public const string MaintenanceTable = "cr40f_manutencoes";
        public const string MaintenancePrimaryId = "cr40f_manutencoesid";

        public const string EmployeeTable = "cr40f_funcionarios";
        public const string EmployeePrimaryId = "cr40f_funcionariosid";
        public const string EmployeeName = "cr40f_nomecompleto";
        public const string EmployeeMicrosoftEmail = "cr40f_emailmicrosoft";
        public const string EmployeeDismissalDate = "cr40f_datadedemissao";

        public const string UserTable = "systemuser";
        public const string UserPrimaryId = "systemuserid";
        public const string UserFullName = "fullname";
        public const string UserInternalEmail = "internalemailaddress";
        public const string UserIsDisabled = "isdisabled";

        public const string AppLogTable = "new_appmotoristaslog";
        public const string AppLogName = "new_name";
        public const string AppLogOccurredAt = "new_occurredat";
        public const string AppLogSeverity = "new_severity";
        public const string AppLogSource = "new_source";
        public const string AppLogAction = "new_action";
        public const string AppLogPhase = "new_phase";
        public const string AppLogComponent = "new_component";
        public const string AppLogDetailId = "new_detailid";
        public const string AppLogDetailType = "new_detailtype";
        public const string AppLogMessage = "new_message";
        public const string AppLogStack = "new_stack";
        public const string AppLogErrorName = "new_errorname";
        public const string AppLogErrorCode = "new_errorcode";
        public const string AppLogAppName = "new_appname";
        public const string AppLogPayloadJson = "new_payloadjson";
        public const string AppLogRawJson = "new_rawjson";

        public const string ServicePassengerTable = "cr40f_servicosporpassageiro";
        public const string ServicePassengerPrimaryId = "cr40f_servicosporpassageiroid";
        public const string ServicePassengerServiceLookup = "cr40f_geral";
        public const string ServicePassengerPassengerLookup = "cr40f_bancodedados";

        public const string ReceiptTable = "cr40f_recibos_v2";
        public const string ReceiptPrimaryId = "cr40f_recibos_v2id";
        public const string ReceiptDriverLookup = "cr40f_motorista";
        public const string ReceiptServiceLookup = "cr40f_reserva";

        public const string ExchangeTable = "cr40f_trocasdecarro";
        public const string ExchangePrimaryId = "cr40f_trocasdecarroid";
        public const string ExchangeDriver1Lookup = "cr40f_motorista1";
        public const string ExchangeDriver2Lookup = "cr40f_motorista2";
        public const string ExchangeVehicle1Lookup = "cr40f_veiculo1antesdatroca";
        public const string ExchangeVehicle2Lookup = "cr40f_veiculo2antesdatroca";
        public const string ExchangeStartDate = "cr40f_iniciodajaneladetroca";
        public const string ExchangeEndDate = "cr40f_fimdajaneladetroca";
        public const string ExchangeStatus = "cr40f_statusdatroca";
        public const string ExchangeType = "new_tipodetroca";
        public const int ExchangeStatusProgrammed = 202410000;
        public const int ExchangeStatusConfirmed = 100000001;
        public const int ExchangeTypeSwap = 100000000;
        public const int ExchangeTypeReturnToBase = 100000001;
        public const int ExchangeTypeTakeFromBase = 100000002;

        public const string VehiclePossessionTable = "new_possedeveiculo";
        public const string VehiclePossessionPrimaryId = "new_possedeveiculoid";
        public const string VehiclePossessionDriverLookup = "new_motorista";
        public const string VehiclePossessionVehicleLookup = "new_veiculo";
        public const string VehiclePossessionStartDate = "new_iniciodaposse";
        public const string VehiclePossessionEndDate = "new_fimdaposse";
        public const string VehiclePossessionExchangeLookup = "new_trocadecarrorelacionada";

        public const string CollisionTable = "cr40f_colisao_v2";
        public const string CollisionPrimaryId = "cr40f_colisao_v2id";
        public const string CollisionDriverLookup = "cr40f_motorista";

        public const string PassengerTable = "cr40f_bancodedados";
        public const string PassengerPrimaryId = "cr40f_bancodedadosid";
        public const string PassengerName = "cr40f_nomedopassageiro";

        public static readonly AccessRights ServiceAccessRights =
            AccessRights.ReadAccess |
            AccessRights.WriteAccess |
            AccessRights.AppendAccess |
            AccessRights.AppendToAccess;

        public static readonly AccessRights AssignedRecordAccessRights = ServiceAccessRights;
        public static readonly AccessRights MaintenanceAccessRights = AssignedRecordAccessRights;
        public static readonly AccessRights ServicePassengerAccessRights = AccessRights.ReadAccess;
        public static readonly AccessRights PassengerAccessRights = AccessRights.ReadAccess;
        public static readonly AccessRights EmployeeSelfAccessRights =
            AccessRights.ReadAccess |
            AccessRights.AppendToAccess;
        public static readonly AccessRights EmployeeContactAccessRights = AccessRights.ReadAccess;
    }
}
