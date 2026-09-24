using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Xunit;

namespace Betinhos.DriverRecordSharing.Tests
{
    public sealed class ComunicadoCommandPluginTests
    {
        private const int Informativo = 100000000;
        private const int Ciencia = 100000001;
        private const int Todos = 100000000;
        private const int Selecionados = 100000001;
        private const int Rascunho = 100000000;
        private const int Disparado = 100000001;
        private const int PushFalhou = 100000002;

        [Fact]
        public void TodosEnviaSomenteParaMotoristasComVinculoUnico()
        {
            var service = new FakeService();
            var valid = Driver("Apto", "apto@empresa.test");
            service.Drivers.AddRange(new[] { valid, Driver("Sem email", ""), Driver("Sem usuario", "ausente@empresa.test") });
            service.Users.Add(User("apto@empresa.test"));
            service.Header = Header(Todos);

            Invoke("Dispatch", Context("new_ComunicadoId", service.Header.Id), service, service);

            Assert.Single(service.Created);
            Assert.Equal(valid.Id, service.Created[0].GetAttributeValue<EntityReference>("new_motorista").Id);
            Assert.Equal(service.Users[0].Id, service.Created[0].GetAttributeValue<EntityReference>("ownerid").Id);
            Assert.Equal(Disparado, service.Header.GetAttributeValue<OptionSetValue>("new_estado").Value);
        }

        [Fact]
        public void SelecionadoSemVinculoRecusaDisparoInteiro()
        {
            var service = new FakeService();
            var valid = Driver("Apto", "apto@empresa.test");
            var invalid = Driver("Pendente", "");
            service.Drivers.AddRange(new[] { valid, invalid });
            service.Users.Add(User("apto@empresa.test"));
            service.Header = Header(Selecionados, new[] { valid.Id, invalid.Id });

            var error = Assert.Throws<TargetInvocationException>(() => Invoke("Dispatch", Context("new_ComunicadoId", service.Header.Id), service, service));

            Assert.IsType<InvalidPluginExecutionException>(error.InnerException);
            Assert.Empty(service.Created);
            Assert.Equal(Rascunho, service.Header.GetAttributeValue<OptionSetValue>("new_estado").Value);
        }

        [Theory]
        [InlineData(1)]
        [InlineData(2)]
        public void SelecionadosValidosRecebemUmaCopiaCada(int count)
        {
            var service = new FakeService();
            for (var index = 0; index < count; index++)
            {
                var email = "driver" + index + "@empresa.test";
                service.Drivers.Add(Driver("Motorista " + index, email));
                service.Users.Add(User(email));
            }
            service.Header = Header(Selecionados, service.Drivers.Select(driver => driver.Id));

            Invoke("Dispatch", Context("new_ComunicadoId", service.Header.Id), service, service);

            Assert.Equal(count, service.Created.Count);
            Assert.Equal(count, service.Created.Select(row => row.GetAttributeValue<string>("new_chaveunica")).Distinct().Count());
        }

        [Fact]
        public void TodosSemMotoristaAptoNaoDispara()
        {
            var service = new FakeService { Header = Header(Todos) };
            service.Drivers.Add(Driver("Sem email", ""));

            var error = Assert.Throws<TargetInvocationException>(() => Invoke("Dispatch", Context("new_ComunicadoId", service.Header.Id), service, service));

            Assert.Contains("Nenhum motorista ativo com acesso", error.InnerException.Message);
            Assert.Empty(service.Created);
        }

        [Fact]
        public void EmailDuplicadoEntreMotoristasNaoRecebeEmTodos()
        {
            var service = new FakeService();
            service.Drivers.AddRange(new[] { Driver("Um", "duplicado@empresa.test"), Driver("Dois", "duplicado@empresa.test"), Driver("Tres", "apto@empresa.test") });
            service.Users.AddRange(new[] { User("duplicado@empresa.test"), User("apto@empresa.test") });
            service.Header = Header(Todos);

            Invoke("Dispatch", Context("new_ComunicadoId", service.Header.Id), service, service);

            Assert.Single(service.Created);
            Assert.Equal("Tres", service.Drivers.Single(driver => driver.Id == service.Created[0].GetAttributeValue<EntityReference>("new_motorista").Id).GetAttributeValue<string>("cr40f_nomecompleto"));
        }

        [Fact]
        public void SegundoDisparoDoMesmoCabecalhoEhRecusado()
        {
            var service = new FakeService { Header = Header(Todos) };
            service.Header["new_estado"] = new OptionSetValue(Disparado);

            var error = Assert.Throws<TargetInvocationException>(() => Invoke("Dispatch", Context("new_ComunicadoId", service.Header.Id), service, service));

            Assert.Contains("já foi disparado", error.InnerException.Message);
            Assert.Empty(service.Created);
        }

        [Fact]
        public void AbrirInformativoMarcaLeituraUmaVez()
        {
            var service = DriverService(Informativo);
            var context = Context("new_DestinatarioId", service.Recipient.Id, service.Users[0].Id);

            Invoke("Open", context, service);
            var readAt = service.Recipient.GetAttributeValue<DateTime>("new_lidoem");
            Invoke("Open", context, service);

            Assert.NotEqual(default(DateTime), readAt);
            Assert.Equal(readAt, service.Recipient.GetAttributeValue<DateTime>("new_lidoem"));
            Assert.Single(service.Updated);
        }

        [Fact]
        public void OutroUsuarioNaoPodeAbrirDestinatario()
        {
            var service = DriverService(Informativo);

            var error = Assert.Throws<TargetInvocationException>(() => Invoke("Open", Context("new_DestinatarioId", service.Recipient.Id, Guid.NewGuid()), service));

            Assert.Contains("não pertence", error.InnerException.Message);
            Assert.Empty(service.Updated);
        }

        [Fact]
        public void CienciaExigeAberturaEAssinaturaValida()
        {
            var service = DriverService(Ciencia);
            var context = Context("new_DestinatarioId", service.Recipient.Id, service.Users[0].Id);
            context.InputParameters["new_AssinaturaJson"] = "[]";

            var beforeOpen = Assert.Throws<TargetInvocationException>(() => Invoke("Acknowledge", context, service));
            Assert.Contains("Abra", beforeOpen.InnerException.Message);
            Invoke("Open", context, service);
            var emptySignature = Assert.Throws<TargetInvocationException>(() => Invoke("Acknowledge", context, service));

            Assert.Contains("assinatura", emptySignature.InnerException.Message, StringComparison.OrdinalIgnoreCase);
            Assert.False(service.Recipient.Contains("new_cienteem"));
        }

        [Fact]
        public void CienciaUsaNomeDoCadastroERepeticaoNaoSubstituiDados()
        {
            var service = DriverService(Ciencia);
            var context = Context("new_DestinatarioId", service.Recipient.Id, service.Users[0].Id);
            Invoke("Open", context, service);
            context.InputParameters["new_AssinaturaJson"] = "[[[0.1,0.2],[0.4,0.5]]]";
            context.InputParameters["new_Observacao"] = "  Recebi a orientação  ";

            Invoke("Acknowledge", context, service);
            var signedAt = service.Recipient.GetAttributeValue<DateTime>("new_cienteem");
            context.InputParameters["new_Observacao"] = "Alterada";
            Invoke("Acknowledge", context, service);

            Assert.Equal("Motorista de teste", service.Recipient.GetAttributeValue<string>("new_nomeassinante"));
            Assert.Equal("Recebi a orientação", service.Recipient.GetAttributeValue<string>("new_observacao"));
            Assert.Equal(signedAt, service.Recipient.GetAttributeValue<DateTime>("new_cienteem"));
            Assert.Equal(2, service.Updated.Count);
        }

        [Fact]
        public void ReenvioAlteraSomentePushFalho()
        {
            var service = DriverService(Informativo);
            service.Header = Header(Todos);
            service.Recipient["new_comunicado"] = new EntityReference("new_comunicadomotorista", service.Header.Id);
            service.Recipient["new_pushstatus"] = new OptionSetValue(PushFalhou);
            var context = Context("new_DestinatarioId", service.Recipient.Id);

            Invoke("RetryPush", context, service, service);

            Assert.Equal(Rascunho, service.Recipient.GetAttributeValue<OptionSetValue>("new_pushstatus").Value);
            Assert.Empty(service.Created);
            var second = Assert.Throws<TargetInvocationException>(() => Invoke("RetryPush", context, service, service));
            Assert.Contains("falhou", second.InnerException.Message);
        }

        private static void Invoke(string method, params object[] args)
        {
            typeof(ComunicadoCommandPlugin).GetMethod(method, BindingFlags.Static | BindingFlags.NonPublic).Invoke(null, args);
        }

        private static RemoteExecutionContext Context(string key, Guid id, Guid? userId = null)
        {
            var context = new RemoteExecutionContext { InitiatingUserId = userId ?? Guid.NewGuid() };
            context.InputParameters[key] = id;
            return context;
        }

        private static Entity Header(int scope, IEnumerable<Guid> selected = null)
        {
            return new Entity("new_comunicadomotorista", Guid.NewGuid())
            {
                ["new_titulo"] = "Orientação operacional",
                ["new_corpo"] = "Leia este comunicado.",
                ["new_tipo"] = new OptionSetValue(Informativo),
                ["new_escopo"] = new OptionSetValue(scope),
                ["new_estado"] = new OptionSetValue(Rascunho),
                ["new_alvosjson"] = "[" + string.Join(",", (selected ?? Enumerable.Empty<Guid>()).Select(id => "\"" + id.ToString("D") + "\"")) + "]"
            };
        }

        private static Entity Driver(string name, string email)
        {
            return new Entity("cr40f_funcionarios", Guid.NewGuid())
            {
                ["cr40f_nomecompleto"] = name,
                ["cr40f_emailmicrosoft"] = email
            };
        }

        private static Entity User(string email)
        {
            return new Entity("systemuser", Guid.NewGuid()) { ["internalemailaddress"] = email };
        }

        private static FakeService DriverService(int type)
        {
            var service = new FakeService();
            var driver = Driver("Motorista de teste", "driver@empresa.test");
            var user = User("driver@empresa.test");
            service.Drivers.Add(driver);
            service.Users.Add(user);
            service.Recipient = new Entity("new_comunicadodestinatario", Guid.NewGuid())
            {
                ["ownerid"] = new EntityReference("systemuser", user.Id),
                ["new_motorista"] = new EntityReference("cr40f_funcionarios", driver.Id),
                ["new_tipo"] = new OptionSetValue(type),
                ["new_pushstatus"] = new OptionSetValue(Rascunho)
            };
            return service;
        }

        private sealed class FakeService : IOrganizationService
        {
            public Entity Header;
            public Entity Recipient;
            public readonly List<Entity> Drivers = new List<Entity>();
            public readonly List<Entity> Users = new List<Entity>();
            public readonly List<Entity> Created = new List<Entity>();
            public readonly List<Entity> Updated = new List<Entity>();

            public Guid Create(Entity entity) { Created.Add(entity); return Guid.NewGuid(); }
            public void Update(Entity entity)
            {
                Updated.Add(entity);
                var existing = entity.LogicalName == "new_comunicadomotorista" ? Header : Recipient;
                foreach (var attribute in entity.Attributes) existing[attribute.Key] = attribute.Value;
            }
            public Entity Retrieve(string entityName, Guid id, ColumnSet columnSet)
            {
                if (entityName == "new_comunicadomotorista" && Header?.Id == id) return Header;
                if (entityName == "new_comunicadodestinatario" && Recipient?.Id == id) return Recipient;
                if (entityName == "systemuser") return Users.Single(user => user.Id == id);
                if (entityName == "cr40f_funcionarios") return Drivers.Single(driver => driver.Id == id);
                throw new InvalidOperationException("Registro inesperado: " + entityName);
            }
            public EntityCollection RetrieveMultiple(QueryBase query)
            {
                var expression = (QueryExpression)query;
                IEnumerable<Entity> records;
                if (expression.EntityName == "cr40f_funcionarios") records = Drivers;
                else if (expression.EntityName == "systemuser") records = Users;
                else throw new InvalidOperationException("Consulta inesperada: " + expression.EntityName);
                var email = expression.Criteria.Conditions.FirstOrDefault(condition => condition.AttributeName == "internalemailaddress" || condition.AttributeName == "cr40f_emailmicrosoft");
                if (email != null) records = records.Where(row => string.Equals(row.GetAttributeValue<string>(email.AttributeName), Convert.ToString(email.Values[0]), StringComparison.OrdinalIgnoreCase));
                return new EntityCollection(records.ToList());
            }
            public void Delete(string entityName, Guid id) => throw new NotSupportedException();
            public OrganizationResponse Execute(OrganizationRequest request) => throw new NotSupportedException();
            public void Associate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();
            public void Disassociate(string entityName, Guid entityId, Relationship relationship, EntityReferenceCollection relatedEntities) => throw new NotSupportedException();
        }
    }
}
