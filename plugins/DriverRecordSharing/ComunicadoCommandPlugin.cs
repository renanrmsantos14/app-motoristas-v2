using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Web.Script.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Betinhos.DriverRecordSharing
{
    public sealed class ComunicadoCommandPlugin : IPlugin
    {
        private const string HeaderTable = "new_comunicadomotorista";
        private const string RecipientTable = "new_comunicadodestinatario";
        private const int Informativo = 100000000;
        private const int Ciencia = 100000001;
        private const int Todos = 100000000;
        private const int Selecionados = 100000001;
        private const int Rascunho = 100000000;
        private const int Disparado = 100000001;
        private const int PushPendente = 100000000;
        private const int PushEnviado = 100000001;
        private const int PushFalhou = 100000002;

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            var system = factory.CreateOrganizationService(null);

            try
            {
                switch (context.MessageName)
                {
                    case "new_DispararComunicadoMotorista":
                        Dispatch(context, caller, system);
                        break;
                    case "new_AbrirComunicadoMotorista":
                        Open(context, system);
                        break;
                    case "new_RegistrarCienciaComunicado":
                        Acknowledge(context, system);
                        break;
                    case "new_ReenviarPushComunicado":
                        RetryPush(context, caller, system);
                        break;
                    case "Update" when context.PrimaryEntityName == HeaderTable:
                        GuardDispatchedHeader(context, system);
                        break;
                    case "Delete" when context.PrimaryEntityName == HeaderTable:
                        GuardDispatchedHeaderDelete(context, system);
                        break;
                    default:
                        throw new InvalidPluginExecutionException("Ação de comunicado desconhecida.");
                }
            }
            catch (InvalidPluginExecutionException) { throw; }
            catch (Exception error)
            {
                throw new InvalidPluginExecutionException("Falha ao processar comunicado. Contate a operação.", error);
            }
        }

        private static Guid InputGuid(IPluginExecutionContext context, string name)
        {
            if (!context.InputParameters.Contains(name) || !(context.InputParameters[name] is Guid id) || id == Guid.Empty)
                throw new InvalidPluginExecutionException("Identificador do comunicado inválido.");
            return id;
        }

        private static string InputString(IPluginExecutionContext context, string name)
        {
            return context.InputParameters.Contains(name) ? Convert.ToString(context.InputParameters[name]) ?? "" : "";
        }

        private static int Choice(Entity entity, string name) => entity.GetAttributeValue<OptionSetValue>(name)?.Value ?? -1;

        private static void GuardDispatchedHeader(IPluginExecutionContext context, IOrganizationService system)
        {
            var target = context.InputParameters.Contains("Target") ? context.InputParameters["Target"] as Entity : null;
            if (target == null || target.LogicalName != HeaderTable) return;
            var header = system.Retrieve(HeaderTable, target.Id, new ColumnSet("new_estado"));
            if (Choice(header, "new_estado") != Disparado) return;
            if (new[] { "new_name", "new_titulo", "new_corpo", "new_tipo", "new_escopo", "new_alvosjson", "new_estado" }.Any(target.Contains))
                throw new InvalidPluginExecutionException("Comunicado disparado não pode ser alterado.");
        }

        private static void GuardDispatchedHeaderDelete(IPluginExecutionContext context, IOrganizationService system)
        {
            var target = context.InputParameters.Contains("Target") ? context.InputParameters["Target"] as EntityReference : null;
            if (target == null || target.LogicalName != HeaderTable) return;
            var header = system.Retrieve(HeaderTable, target.Id, new ColumnSet("new_estado"));
            if (Choice(header, "new_estado") == Disparado)
                throw new InvalidPluginExecutionException("Comunicado disparado não pode ser excluído.");
        }

        private static Entity RecipientForCaller(IPluginExecutionContext context, IOrganizationService system)
        {
            var recipient = system.Retrieve(RecipientTable, InputGuid(context, "new_DestinatarioId"), new ColumnSet(
                "ownerid", "new_motorista", "new_tipo", "new_abertoem", "new_lidoem", "new_cienteem", "new_pushstatus"));
            var owner = recipient.GetAttributeValue<EntityReference>("ownerid");
            if (owner == null || owner.LogicalName != "systemuser" || owner.Id != context.InitiatingUserId)
                throw new InvalidPluginExecutionException("Este comunicado não pertence ao motorista autenticado.");
            var user = system.Retrieve("systemuser", context.InitiatingUserId, new ColumnSet("internalemailaddress"));
            var email = user.GetAttributeValue<string>("internalemailaddress");
            if (string.IsNullOrWhiteSpace(email)) throw new InvalidPluginExecutionException("Usuário sem e-mail Microsoft.");
            var employee = new QueryExpression("cr40f_funcionarios") { ColumnSet = new ColumnSet("cr40f_nomecompleto") };
            employee.Criteria.AddCondition("cr40f_emailmicrosoft", ConditionOperator.Equal, email);
            employee.Criteria.AddCondition("cr40f_status", ConditionOperator.Equal, 0);
            employee.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            employee.Criteria.AddCondition("cr40f_tipodevinculo", ConditionOperator.In, new object[] { 0, 1 });
            var matches = system.RetrieveMultiple(employee).Entities;
            var linked = recipient.GetAttributeValue<EntityReference>("new_motorista");
            if (matches.Count != 1 || linked == null || matches[0].Id != linked.Id)
                throw new InvalidPluginExecutionException("Usuário não está vinculado ao motorista deste comunicado.");
            return recipient;
        }

        private static void Open(IPluginExecutionContext context, IOrganizationService system)
        {
            var recipient = RecipientForCaller(context, system);
            var update = new Entity(RecipientTable, recipient.Id);
            if (!recipient.Contains("new_abertoem")) update["new_abertoem"] = DateTime.UtcNow;
            if (Choice(recipient, "new_tipo") == Informativo && !recipient.Contains("new_lidoem"))
                update["new_lidoem"] = DateTime.UtcNow;
            if (update.Attributes.Count > 0) system.Update(update);
        }

        private static void Acknowledge(IPluginExecutionContext context, IOrganizationService system)
        {
            var recipient = RecipientForCaller(context, system);
            if (Choice(recipient, "new_tipo") != Ciencia)
                throw new InvalidPluginExecutionException("Este comunicado não exige assinatura.");
            if (recipient.Contains("new_cienteem")) return;
            if (!recipient.Contains("new_abertoem"))
                throw new InvalidPluginExecutionException("Abra o comunicado antes de assinar.");

            var signature = InputString(context, "new_AssinaturaJson");
            var observation = InputString(context, "new_Observacao").Trim();
            if (observation.Length > 1000) throw new InvalidPluginExecutionException("A observação deve ter até 1.000 caracteres.");
            ValidateSignature(signature);

            var linked = recipient.GetAttributeValue<EntityReference>("new_motorista");
            var employee = system.Retrieve("cr40f_funcionarios", linked.Id, new ColumnSet("cr40f_nomecompleto"));

            var update = new Entity(RecipientTable, recipient.Id);
            update["new_cienteem"] = DateTime.UtcNow;
            update["new_nomeassinante"] = employee.GetAttributeValue<string>("cr40f_nomecompleto") ?? "";
            update["new_observacao"] = observation;
            update["new_assinaturajson"] = signature;
            system.Update(update);
        }

        private static void ValidateSignature(string json)
        {
            if (string.IsNullOrWhiteSpace(json) || json.Length > 100000)
                throw new InvalidPluginExecutionException("Assinatura inválida ou grande demais.");
            object parsed;
            try { parsed = new JavaScriptSerializer { MaxJsonLength = 100000 }.DeserializeObject(json); }
            catch { throw new InvalidPluginExecutionException("Assinatura inválida."); }
            var strokes = parsed as object[];
            if (strokes == null || strokes.Length == 0) throw new InvalidPluginExecutionException("Desenhe sua assinatura.");
            var total = 0;
            foreach (var strokeValue in strokes)
            {
                var stroke = strokeValue as object[];
                if (stroke == null || stroke.Length < 2) throw new InvalidPluginExecutionException("Traço de assinatura inválido.");
                total += stroke.Length;
                foreach (var pointValue in stroke)
                {
                    var point = pointValue as object[];
                    if (point == null || point.Length != 2) throw new InvalidPluginExecutionException("Ponto de assinatura inválido.");
                    foreach (var coordinate in point)
                    {
                        double number;
                        if (!double.TryParse(Convert.ToString(coordinate, CultureInfo.InvariantCulture), NumberStyles.Float, CultureInfo.InvariantCulture, out number) || double.IsNaN(number) || number < 0 || number > 1)
                            throw new InvalidPluginExecutionException("Coordenada de assinatura inválida.");
                    }
                }
            }
            if (total > 4000) throw new InvalidPluginExecutionException("Assinatura grande demais.");
        }

        private static HashSet<Guid> SelectedIds(Entity header)
        {
            var raw = header.GetAttributeValue<string>("new_alvosjson") ?? "[]";
            object parsed;
            try { parsed = new JavaScriptSerializer().DeserializeObject(raw); }
            catch { throw new InvalidPluginExecutionException("Lista de motoristas inválida."); }
            var array = parsed as object[];
            if (array == null) throw new InvalidPluginExecutionException("Lista de motoristas inválida.");
            var ids = new HashSet<Guid>();
            foreach (var entry in array)
            {
                Guid id;
                if (!Guid.TryParse(Convert.ToString(entry), out id) || id == Guid.Empty)
                    throw new InvalidPluginExecutionException("Motorista selecionado inválido.");
                ids.Add(id);
            }
            return ids;
        }

        private static List<Entity> ActiveDrivers(IOrganizationService system)
        {
            var query = new QueryExpression("cr40f_funcionarios")
            {
                ColumnSet = new ColumnSet("cr40f_nomecompleto", "cr40f_emailmicrosoft", "cr40f_tipodevinculo"),
                PageInfo = new PagingInfo { Count = 500, PageNumber = 1 }
            };
            query.Criteria.AddCondition("cr40f_status", ConditionOperator.Equal, 0);
            query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            query.Criteria.AddCondition("cr40f_tipodevinculo", ConditionOperator.In, new object[] { 0, 1 });
            var result = new List<Entity>();
            EntityCollection page;
            do
            {
                page = system.RetrieveMultiple(query);
                result.AddRange(page.Entities);
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            } while (page.MoreRecords);
            return result;
        }

        private static void Dispatch(IPluginExecutionContext context, IOrganizationService caller, IOrganizationService system)
        {
            var id = InputGuid(context, "new_ComunicadoId");
            // Custom API also requires the header table's write privilege. The caller must read this row.
            caller.Retrieve(HeaderTable, id, new ColumnSet("new_estado"));
            var header = system.Retrieve(HeaderTable, id, new ColumnSet("new_titulo", "new_corpo", "new_tipo", "new_escopo", "new_alvosjson", "new_estado"));
            if (Choice(header, "new_estado") != Rascunho)
                throw new InvalidPluginExecutionException("Comunicado já foi disparado.");
            var title = (header.GetAttributeValue<string>("new_titulo") ?? "").Trim();
            var body = (header.GetAttributeValue<string>("new_corpo") ?? "").Trim();
            var type = Choice(header, "new_tipo");
            var scope = Choice(header, "new_escopo");
            if (title.Length == 0 || title.Length > 150 || body.Length == 0 || body.Length > 4000 || (type != Informativo && type != Ciencia) || (scope != Todos && scope != Selecionados))
                throw new InvalidPluginExecutionException("Dados do comunicado inválidos.");

            var selected = scope == Selecionados ? SelectedIds(header) : null;
            var activeDrivers = ActiveDrivers(system);
            var duplicateEmails = new HashSet<string>(activeDrivers
                .Select(row => row.GetAttributeValue<string>("cr40f_emailmicrosoft")?.Trim())
                .Where(email => !string.IsNullOrWhiteSpace(email))
                .GroupBy(email => email, StringComparer.OrdinalIgnoreCase)
                .Where(group => group.Count() > 1)
                .Select(group => group.Key), StringComparer.OrdinalIgnoreCase);
            var drivers = activeDrivers.Where(row => selected == null || selected.Contains(row.Id)).ToList();
            if (drivers.Count == 0 || (selected != null && drivers.Count != selected.Count))
                throw new InvalidPluginExecutionException("A seleção inclui motorista inativo ou não contém destinatários.");

            var destinations = new List<Tuple<Entity, Entity>>();
            foreach (var driver in drivers)
            {
                var email = driver.GetAttributeValue<string>("cr40f_emailmicrosoft")?.Trim();
                if (string.IsNullOrWhiteSpace(email) || duplicateEmails.Contains(email))
                {
                    if (scope == Todos) continue;
                    throw new InvalidPluginExecutionException("Motorista sem vínculo Microsoft único: " + driver.GetAttributeValue<string>("cr40f_nomecompleto"));
                }
                var userQuery = new QueryExpression("systemuser") { ColumnSet = new ColumnSet("systemuserid") };
                userQuery.Criteria.AddCondition("internalemailaddress", ConditionOperator.Equal, email);
                userQuery.Criteria.AddCondition("isdisabled", ConditionOperator.Equal, false);
                var users = system.RetrieveMultiple(userQuery).Entities;
                if (users.Count != 1)
                {
                    if (scope == Todos) continue;
                    throw new InvalidPluginExecutionException("Vínculo Microsoft ausente ou duplicado: " + driver.GetAttributeValue<string>("cr40f_nomecompleto"));
                }
                destinations.Add(Tuple.Create(driver, users[0]));
            }
            if (destinations.Count == 0)
                throw new InvalidPluginExecutionException("Nenhum motorista ativo com acesso ao app para receber o comunicado.");

            var now = DateTime.UtcNow;
            foreach (var destination in destinations)
            {
                var driver = destination.Item1;
                var recipient = new Entity(RecipientTable);
                var recipientName = title + " - " + (driver.GetAttributeValue<string>("cr40f_nomecompleto") ?? "");
                recipient["new_name"] = recipientName.Substring(0, Math.Min(150, recipientName.Length));
                recipient["new_chaveunica"] = id.ToString("D") + ":" + driver.Id.ToString("D");
                recipient["new_comunicado"] = new EntityReference(HeaderTable, id);
                recipient["new_motorista"] = new EntityReference("cr40f_funcionarios", driver.Id);
                recipient["ownerid"] = new EntityReference("systemuser", destination.Item2.Id);
                recipient["new_titulo"] = title;
                recipient["new_corpo"] = body;
                recipient["new_tipo"] = new OptionSetValue(type);
                recipient["new_enviadoem"] = now;
                recipient["new_pushstatus"] = new OptionSetValue(PushPendente);
                system.Create(recipient);
            }

            var update = new Entity(HeaderTable, id);
            update["new_estado"] = new OptionSetValue(Disparado);
            update["new_disparadoem"] = now;
            update["new_disparadopor"] = context.InitiatingUserId.ToString("D");
            system.Update(update);
        }

        private static void RetryPush(IPluginExecutionContext context, IOrganizationService caller, IOrganizationService system)
        {
            var recipientId = InputGuid(context, "new_DestinatarioId");
            var recipient = system.Retrieve(RecipientTable, recipientId, new ColumnSet("new_comunicado", "new_pushstatus", "new_tipo", "new_lidoem", "new_cienteem"));
            var header = recipient.GetAttributeValue<EntityReference>("new_comunicado");
            if (header == null) throw new InvalidPluginExecutionException("Comunicado do destinatário não encontrado.");
            caller.Retrieve(HeaderTable, header.Id, new ColumnSet("new_estado"));
            var pushStatus = Choice(recipient, "new_pushstatus");
            var pending = Choice(recipient, "new_tipo") == Informativo ? !recipient.Contains("new_lidoem") : !recipient.Contains("new_cienteem");
            // Falhou: reenvio. Enviado e ainda pendente: lembrete ao motorista.
            if (pushStatus != PushFalhou && !(pushStatus == PushEnviado && pending))
                throw new InvalidPluginExecutionException("Push só pode ser reenviado após falha ou como lembrete de comunicado pendente.");
            var update = new Entity(RecipientTable, recipientId);
            update["new_pushstatus"] = new OptionSetValue(PushPendente);
            update["new_pusherro"] = "";
            system.Update(update);
        }
    }
}
