<html>

<head>
    <meta http-equiv="pragma" content="no-cache">

    <script language="JavaScript" src="/contratadaweb/biblio/Js/Key.js"></script>
    <script language="JavaScript" src="/contratadaweb/biblio/Js/ajax/ArrayUtil.js"></script>
    <script language="JavaScript" src="/contratadaweb/biblio/Js/ajax/Prototype.js"></script>
    <script language="JavaScript" src="/contratadaweb/biblio/Js/ajax/browserType.js"></script>
    <script language="JavaScript" src="/contratadaweb/biblio/Js/ajax/Delegate.js"></script>
    <script language="JavaScript" src="/contratadaweb/biblio/Js/ajax/MCFormMapping.js"></script>
    <script language="JavaScript" src="/contratadaweb/biblio/Js/ajax/MCAjax.js"></script>
    <script language="JavaScript" src="/contratadaweb/biblio/Js/EventManager.js"></script>
    <script>
        /**
         * @author e004596
         * @since 27/02/2008
         */
        Servidor =
        {
            // Desenvolvimento
            _ip: "http://192.168.122.110/",
            // Desenvolvimento
            _ip2: "http://10.2.130.72:8280/",
            getSessionId: function () {
                return "1F8C12CC502E9F4388EC92DAD4AF7780.PLNJBBHEGDIS08";
            },
            Configuracao:
            {
                getURL: function () {
                    return Servidor._ip + "WebIntegracaoJava/";
                },

                getURLRelatorio: function () {
                    return Servidor._ip + "WebRelatorio/";
                },

                getURLApropriacao: function () {
                    return Servidor._ip + "WebApropriacao/";
                },
                getURLApropriacaoPropria: function () {
                    return Servidor._ip + "WebApropriacaoPropria/";
                },
                getURLpdaCondisconsulta: function () {
                    return Servidor._ip + "WebConsultasCondis/";
                },
                getURLRaiz: function () {
                    return Servidor._ip;
                },
                getURLGestor: function () {
                    return Servidor._ip2 + "gestorservicos/pages/gestor/gestor.jsf";
                }
            }
        }
        ServidorCONDIS =
        {
            // Desenvolvimento
            _ip: "/contratadaweb",

            Configuracao:
            {
                getURL: function () {
                    return ServidorCONDIS._ip;
                }
            }
        }
        ServidorPM =
        {
            // Desenvolvimento
            _ip: "http://192.168.122.120/",

            Configuracao:
            {
                getURL: function () {
                    return ServidorPM._ip + "gdispm/";
                }
            }
        }

    </script>
    <script language="JavaScript" src="/contratadaweb/biblio/Js/IntegracaoJava.js"></script>
    <script language="JavaScript" src="/contratadaweb/biblio/Js/Util.js"></script>
    <script language="JavaScript" src="/contratadaweb/biblio/Js/StringUtil.js"></script>
    <script language="JavaScript" src="/contratadaweb/biblio/Js/DataUtil.js"></script>


    <script language="JavaScript">

        window.moveTo(0, 0);
        window.resizeTo(screen.availWidth, screen.availHeight);

        var mcAjax;
        var mapFrmRC;

        function abrirJan(endereco, nomejan, atributos) {
            window.open(endereco, nomejan, atributos)
        }

        function buscarDadosEqptoTrafo() {
            var trafo = $("trafo").value;
            if (trafo == "")
                IntegracaoJava.consultas.equipamentoPorMalhas({ numero: $("num_disp").value, malhas: $("Malhas").value },
                    {
                        onSuccess: Delegate(this, function (rows) {
                            if (rows.length == 0) {
                                alert("Equipamento n o encontrado.");
                            }
                            else if (rows.length == 1) {
                                $("localOrigem").value = rows[0].local;
                                mcAjax.load("ListaLocais.asp?regiao=" + rows[0].regiao, $("ajaxContainer")).onComplete = Delegate(this, function (q1) {
                                    if (q1.responseData.err.code == 0) {
                                        if (q1.responseData.rows.length > 0) {
                                            $('local').options.length = 0;
                                            var arrayRetorno = rows[0];
                                            arrayRetorno.trafo.local = arrayRetorno.local + ' - ' + arrayRetorno.descricao;
                                            arrayRetorno.Alimentador = arrayRetorno.subEsta + arrayRetorno.alimenta;
                                            arrayRetorno.Num_Log = arrayRetorno.numeroEndereco;
                                            arrayRetorno.endereco = StringUtil.trim(arrayRetorno.endereco);
                                            arrayRetorno.trafo = "";
                                            arrayRetorno.matricula = arrayRetorno.posicaoUTM;
                                            mapFrmRC.setData(arrayRetorno);
                                        }
                                        else {
                                            alert(q1.responseData.err.message);
                                        }
                                    }
                                    else {
                                        alert(q1.responseData.err.message);
                                    }
                                });
                            }
                        })
                    });

            else {

                var arrTrafo = trafo.split("-");
                var numeroTrafo = arrTrafo[0];
                var fasesTrafo = arrTrafo[1];
                var potenciaTrafo = arrTrafo[2];
                var local = $("local").value;
                var localDescricao = local.split("-");
                var numeroLocal = localDescricao;

                IntegracaoJava.consultas.trafoPorFasesPotenciaLocal(numeroTrafo, fasesTrafo, potenciaTrafo, numeroLocal,
                    {
                        onSuccess: Delegate(this, function (rows) {
                            if (rows.length > 0) {
                                var arrayRetorno = rows[0];
                                arrayRetorno.subalim = arrayRetorno.subestacao + arrayRetorno.alimentador;
                                arrayRetorno.tipo = "01";
                                arrayRetorno.trafo = arrayRetorno.numero + "-" + arrayRetorno.numeroFases + "-" + arrayRetorno.potencia;
                                arrayRetorno.num_disp = arrayRetorno.numero;
                                arrayRetorno.eloFusivel = "";
                                arrayRetorno.matricula = arrayRetorno.posicaoUTM;
                                arrayRetorno.TipoTrecho = arrayRetorno.TipoTrecho;
                                arrayRetorno.Num_Log = arrayRetorno.numeroEndereco;
                                arrayRetorno.Endereco_Eqp = "";
                                arrayRetorno.Bairro = (arrayRetorno.bairro == null ? "" : arrayRetorno.bairro);
                                arrayRetorno.compl = "";
                                mapFrmRC.setData(arrayRetorno);
                            }
                        })
                    });
            }
        }

        function Page_Onload() {
            mcAjax = new MCAjax();
            mapFrmRC = new MCFormMapping("dados");
            mapFrmRC.changeFocusOnEnter = false;

            EventManager.addListener($("BotaoEquipamento"), {
                onclick: function () {
                    Enter($("num_disp").name, 13);
                }
            });

            EventManager.addListener($("BotaoIdentificador"), {
                onclick: function () {
		PesquisaInstala  o();
                }
            });

            EventManager.addListener($("local_defeito"), {
                onkeyup: function () {
                    return TamanhoMaximo2($("local_defeito"), 30);
                }
            });

            EventManager.addListener($("local_defeito"), {
                onkeydown: function () {
                    return TamanhoMaximo($("local_defeito"), 30);
                }
            });

            EventManager.addListener($("recur"), {
                onkeyup: function () {
                    return TamanhoMaximo2($("recur"), 120);
                }
            });

            EventManager.addListener($("recur"), {
                onkeydown: function () {
                    return TamanhoMaximo($("recur"), 120);
                }
            });

            EventManager.addListener($("Desc_Serv"), {
                onkeydown: function () {
                    return TamanhoMaximo($("Desc_Serv"), 160);
                }
            });

            EventManager.addListener($("Desc_Serv"), {
                onkeyup: function () {
                    return TamanhoMaximo2($("Desc_Serv"), 160);
                }
            });

            EventManager.addListener($("Observ"), {
                onkeydown: function () {
                    return TamanhoMaximo($("Observ"), 160);
                }
            });

            EventManager.addListener($("Observ"), {
                onkeyup: function () {
                    return TamanhoMaximo2($("Observ"), 160);
                }
            });
        }

        function HabCampos(obj) {
            $("num_disp").disabled = ($("chkforcada").checked);
            $("identificador").disabled = ($("chkforcada").checked);
            $("trafo").disabled = ($("chkforcada").checked);
            $("tipo").disabled = !($("chkforcada").checked);

            if ($("chkforcada").checked) {
                $("num_disp").value = "";
                $("tipo").value = "";
                $("trafo").value = "";
                $("identificador").value = "";
            }
        }

        function HabEquTrafo(valor) {
            if (valor == 01) {
                document.dados.trafo.disabled = false;
                document.dados.num_disp.disabled = true;
            }
            else {
                if (valor == "") {
                    document.dados.num_disp.disabled = true;
                    document.dados.trafo.disabled = true;
                }
                else {
                    document.dados.num_disp.disabled = false;
                    document.dados.trafo.disabled = true;
                }
            }
        }

        function lstselRegiao_onchange(pObj, pRegiao, pLocal) {
            mcAjax.load("listalocais.jsp?regiao=" + (pRegiao == "" ? pObj.value : pRegiao), $("ajaxContainer")).onComplete = Delegate(this, function (q1) {
                if (q1.responseData.err.code == 0) {
                    if (q1.responseData.rows.length > 0) {
                        $('local').options.length = 0;

                        for (var i = 0; i < q1.responseData.rows.length; i++) {
                            $('local').options[i] = new Option(q1.responseData.rows[i].local + ' - ' + q1.responseData.rows[i].descricao, q1.responseData.rows[i].local);
                            $('local').options[i].selected = (pLocal == q1.responseData.rows[i].local);
                        }
                    }
                    else {
                        alert(q1.responseData.err.message);
                    }
                }
                else {
                    alert(q1.responseData.err.message);
                }
            });
        }

        var cont = 1;
        function addMateriais() {
            var tbodyElem = document.getElementById("tmateriais");
            var trElem, tdElem;
            cont++;

            trElem = tbodyElem.insertRow(tbodyElem.rows.length);

            tdElem = trElem.insertCell(trElem.cells.length);
            tdElem.innerHTML = tbodyElem.rows[tbodyElem.rows.length - 2].cells[0].innerHTML;
            tdElem.style.background = "#eeeeee";
            tdElem.style.fontWeight = "bold";
            tdElem.align = "Right";

            tdElem = trElem.insertCell(trElem.cells.length);
            tdElem.innerHTML = tbodyElem.rows[tbodyElem.rows.length - 2].cells[1].innerHTML;
            document.all("selMaterial")[tbodyElem.rows.length - 1].selectedIndex = 0;

            tdElem = trElem.insertCell(trElem.cells.length);
            tdElem.innerHTML = tbodyElem.rows[tbodyElem.rows.length - 2].cells[2].innerHTML;
            tdElem.style.background = "#eeeeee";
            tdElem.style.fontWeight = "bold";
            tdElem.align = "Right";

            tdElem = trElem.insertCell(trElem.cells.length);
            tdElem.innerHTML = tbodyElem.rows[tbodyElem.rows.length - 2].cells[3].innerHTML;
            document.all("txtQtde")[tbodyElem.rows.length - 1].value = "";

            tdElem = trElem.insertCell(trElem.cells.length);
            tdElem.innerHTML = "<a Style='Cursor:Hand' name=btoExcluir id=btoExcluir onclick='deleteMateriais(this.myIndex);' myIndex='" + (tbodyElem.rows.length - 1) + "'><img src='/contratadaweb/servicos/despachante/images/cancelar.png'></a>";
        }

        function deleteMateriais(index) {
            var tbodyElem = document.getElementById("tmateriais");
            tbodyElem.deleteRow(index);
            for (i = 1; i < tbodyElem.rows.length; i++) {
                if (typeof (document.all("btoExcluir").length) == "undefined") {
                    document.all("btoExcluir").myIndex = 1;
                }
                else {
                    document.all("btoExcluir")[i - 1].myIndex = i;
                }
            }
        }

        function buscaTrafo() {
            $("trafo").value = "";
            $("fasesTrafo").value = "";
            $("potenciaTrafo").value = "";
            $("identificador").value = "";
            $("num_disp").value = "";
            $("codDisp").value = "";

            abrirJan('/contratadaweb/servicos/despachante/det_aten/selecionatrafo.jsp?TelaOrigem=NotaManutencao', 'Equipamento', 'toollbar=0,width=660,height=350,left=0,top=0,scrolling=auto,scrollbars=yes');
        }


        function LimparCampos() {
            var campos = document.getElementById("dados");

            //Verifica se o formul rio j  cont m dados preenchidos pelo n mero do servi o
            if (document.getElementById("Numserv").value == "") {
                for (var i = 0; i < campos.length; i++) {
                    //verifica todos os campos do formul rio para que possam ser limpos
                    if (campos.elements[i].type == 'text' || campos.elements[i].type == 'textarea' || campos.elements[i].type == 'select-one' || campos.elements[i].type == 'checkbox') {
                        //campos de RAMO NEG CIO e SOLICIT j  vem preenchido por default, ent o   necess rio mante-los
                        if (campos.elements[i].name != 'ramoNegocio' && campos.elements[i].name != 'solicit') {
                            campos.elements[i].value = "";
                        }
                    }
                }
            }
        }

        function ChecaDados() {
            var bolSairFora = false;

            if (typeof (document.all("selMaterial")[0].length) != "undefined") {
                for (i = 0; i < document.all("selMaterial").length - 1; i++) {
                    for (k = i + 1; k < document.all("selMaterial").length; k++) {
                        if (document.all("selMaterial")[i].selectedIndex == document.all("selMaterial")[k].selectedIndex) {
                            alert("N o pode se repetir materiais no cadastro!");
                            bolSairFora = true;
                            break;
                        }
                    }
                    if (bolSairFora) {
                        return false;
                        break;
                    }
                }
            }

            if (typeof (document.all("txtQtde").length) != "undefined") {
                for (i = 0; i < document.all("txtQtde").length; i++) {
                    if (isNaN(document.all("txtQtde")[i].value)) {
                        alert("Campo Qtde deve ser num rico.");
                        return false;
                    }
                }
            }

            if (ConsisteForm()) {
                document.dados.num_disp.disabled = false;
                document.dados.IncluirNota.value = "Incluir";
                $('IncluirNota').value = "Incluir";

                var t = $("trafo").value;

                if (t != "") {
                    var arrTrafo = t.split("-");
                    var numeroTrafo = arrTrafo[0];
                    var fasesTrafo = arrTrafo[1];
                    var potenciaTrafo = arrTrafo[2];
                }

                $("codDisp").value = $("tipo").options[$("tipo").selectedIndex].value;
                if ($("codDisp").value == "01") {
                    if (numeroTrafo) {
                        $("numDisp").value = numeroTrafo;
                    } else {
                        $("numDisp").value = "";
                    }
                    if (fasesTrafo) {
                        $("fasesTrafo").value = fasesTrafo;
                    } else {
                        $("fasesTrafo").value = "";
                    }
                    if (potenciaTrafo) {
                        $("potenciaTrafo").value = potenciaTrafo;
                    } else {
                        $("potenciaTrafo").value = "";
                    }
                }
                else {
                    $("numDisp").value = $("num_disp").value;
                }

                if ($("numDisp").value != "") {
                    document.dados.submit();
                } else {
                    $("hdnLocal").value = $("local").value;
                    document.dados.submit();
                }
            }
        }

        function Submeter() {
            if (document.dados.txtQtde.length > 1) {
                for (i = 0; i < document.dados.txtQtde.length; i++) {
                    if (document.dados.selMaterial(i).value != "" && document.dados.txtQtde(i).value == "") {
                        alert("Informe a quantidade de material necess rio");
                        document.dados.txtQtde(i).focus();
                        return false;
                    }
                }
                return true;
            }
            else {
                if (document.dados.selMaterial.value != "" && document.dados.txtQtde.value == "") {
                    alert("Informe a quantidade de material necess rio");
                    document.dados.txtQtde.focus();
                    return false;
                }
                return true;
            }
        }

        function ConsisteForm() {
            try {
                with (document.dados) {
                    // Se n o for for ada
                    if (!$("chkForcada").checked) {
                        if ($("identificador").value == "" && $("num_disp").value == "" && $("trafo").value == "") {
                            alert("Informe um dos campos abaixo:\n\nP. de Instala  o\nTransformador\nEquipamento");
                            $("identificador").focus();
                            return false;
                        }

                        e = elements;
                        for (i = 0; i < e.length; i++) {
                            if (e[i].requerido != undefined) {
                                if (e[i].value == "" && !e[i].isBuffer) {
                                    alert("Preencha o campo " + e[i].nome);
                                    e[i].focus();
                                    return false;
                                }
                            }
                        }
                    }
                    else {
                        // Para o caso do cadastro for ado, obrigar o preenchimento dos campos abaixo
                        if ($("endereco").value == "") {
                            alert("Informe o endere o");
                            $("endereco").focus();
                            return false;
                        }

                        if ($("numEndereco").value == "") {
                            alert("Informe o n mero do endere o");
                            $("numEndereco").focus();
                            return false;
                        }

                        if ($("bairro").value == "") {
                            alert("Informe o Bairro");
                            $("bairro").focus();
                            return false;
                        }

                        if ($("referencia").value == "") {
                            alert("Informe a refer ncia");
                            $("referencia").focus();
                            return false;
                        }

                        if ($("regiao").value == "") {
                            alert("Informe a regi o");
                            $("regiao").focus();
                            return false;
                        }

                        if ($("local").value == "") {
                            alert("Informe o Local");
                            $("local").focus();
                            return false;
                        }

                        if ($("tiposerv").value == "") {
                            alert("Informe o Tipo de Servi o");
                            $("tiposerv").focus();
                            return false;
                        }

                        if ($("Projeta").value == "") {
                            alert("Informe o Executor");
                            $("Projeta").focus();
                            return false;
                        }

                        if ($("TipoTurma").value == "") {
                            alert("Informe o Tipo de Turma");
                            $("TipoTurma").focus();
                            return false;
                        }
                    }

                    return true;
                }
            }
            catch (Exce  o) { }
        }

        function Enter() {
            $("trafo").value = "";
            $("fasesTrafo").value = "";
            $("potenciaTrafo").value = "";
            $("identificador").value = "";

            if ($("num_disp").value == "") {
                $("num_disp").focus();
                return false;
            }
            else {
                IntegracaoJava.consultas.equipamentosPorMalha(StringUtil.trim($("num_disp").value), 'DL').onSuccess = function (rows) {
                    if (rows.length > 0) {
                        mcAjax.load("listalocais.jsp?regiao=" + rows[0].regiao, $("ajaxContainer")).onComplete = Delegate(this, function (q1) {
                            if (q1.responseData.err.code == 0) {
                                if (q1.responseData.rows.length > 0) {
                                    $('local').options.length = 0;

                                    // Lista os Locais
                                    for (var i = 0; i < q1.responseData.rows.length; i++) {
                                        $('local').options[i] = new Option(q1.responseData.rows[i].local + ' - ' + q1.responseData.rows[i].descricao, q1.responseData.rows[i].local);
                                        if (rows[0].local == q1.responseData.rows[i].local) {
                                            $('local').options[i].selected = true;
                                        }
                                    }

                                    // Lista o Equipamento
                                    var arrayRetorno = rows[0];

                                    arrayRetorno.subalim = arrayRetorno.subEsta + arrayRetorno.alimenta;
                                    arrayRetorno.numEndereco = arrayRetorno.numeroEndereco;
                                    arrayRetorno.num_disp = arrayRetorno.numero;
                                    arrayRetorno.trafo = "";
                                    arrayRetorno.matricula = arrayRetorno.posicaoUTM;

                                    mapFrmRC.setData(arrayRetorno);
                                }
                                else {
                                    alert(q1.responseData.err.message);
                                }
                            }
                            else {
                                alert(q1.responseData.err.message);
                            }
                        });
                    }
                    else {
                        alert("Equipamento n o encontrado.");
                        $("num_disp").value = "";
                        $("num_disp").focus();
                    }
                }
            }
        }

        function PesquisaInstala  o()
        {
            $("num_disp").value = "";
            $("codDisp").value = "";
            $("trafo").value = "";
            $("fasesTrafo").value = "";
            $("potenciaTrafo").value = "";

            if ($("identificador").value == "") {
                alert("Informe o P. de Instala  o");
                $("identificador").focus();
                return false;
            }
            else {
                IntegracaoJava.consultas.parceiroNegocioPorInstalacao(StringUtil.trim($("identificador").value)).onSuccess = function (rows) {
                    if (rows.length > 0) {
                        // Busca pela regiao apartir do LOCAL porque o parceiro neg cio possui regiao = MG
                        mcAjax.load("/contratadaweb/servicos/despachante/buscarregiaoporlocal.jsp?local=" + rows[0].unidadeLeitura.substring(2, 6)).onComplete = Delegate(this, function (q2) {
                            if (q2.responseData.err.code == 0) {
                                if (q2.responseData.rows.length > 0) {
                                    // Lista os locais da Regi o encontrada
                                    mcAjax.load("/contratadaweb/servicos/despachante/listalocais.jsp?regiao=" + q2.responseData.rows[0].regiao).onComplete = Delegate(this, function (q1) {
                                        if (q1.responseData.err.code == 0) {
                                            if (q1.responseData.rows.length > 0) {
                                                $('local').options.length = 0;

                                                // Lista os Locais
                                                for (var i = 0; i < q1.responseData.rows.length; i++) {
                                                    $('local').options[i] = new Option(q1.responseData.rows[i].local + ' - ' + q1.responseData.rows[i].descricao, q1.responseData.rows[i].local);
                                                    if (rows[0].local == q1.responseData.rows[i].local) {
                                                        $('local').options[i].selected = true;
                                                    }
                                                }

                                                // Preenche a tela com os dados do PN
                                                var arrayRetorno = rows[0];
                                                arrayRetorno.local = arrayRetorno.unidadeLeitura.substring(2, 6);
                                                arrayRetorno.regiao = q2.responseData.rows[0].regiao;
                                                arrayRetorno.endereco = arrayRetorno.nomelogradouro;
                                                arrayRetorno.numEndereco = arrayRetorno.numero;
                                                arrayRetorno.compl = arrayRetorno.complemento;
                                                arrayRetorno.codClasse = arrayRetorno.classe.substring(0, 2);
                                                arrayRetorno.ddd = arrayRetorno.telefone.substring(0, 2);
                                                arrayRetorno.telefone = arrayRetorno.telefone.substring(2, 10);
                                                arrayRetorno.subClasse = arrayRetorno.classe.substring(2, 4);

                                                if (StringUtil.trim(arrayRetorno.numero) == "" || isNaN(arrayRetorno.numero))
                                                    arrayRetorno.numero = "0";

                                                mapFrmRC.setData(arrayRetorno);
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }
                    else {
                        alert("Instala  o n o encontrada");
                    }
                }
            }
        }

    </script>
    <title>Nota de Servi o</title>
</head>

<body topmargin="0" leftmargin="0" bgcolor="white" rightmargin="0" onLoad="Page_Onload();">
    <link rel="stylesheet" href="/contratadaweb/condis/templates/azul/css/formata.css">
    <link rel="stylesheet" href="/contratadaweb/condis/templates/azul/css/print.css" media="print">
    <form name="dados" id="dados" onSubmit="return Submeter();">
        <table align="Center" Class=TabelaForm border=0 bordercolor=red>
            <Caption>Nota de Servi o de Manuten o</Caption>
            <tr Align=Center>
                <td Colspan=6>
                    <input type="checkbox" name="chkForcada" value="CF" onClick="HabCampos(this);">Cadastro For ado
                </td>
            </tr>
            <Tr>
                <Th>P. de Instala o:&nbsp;</Th>
                <Td colspan=5>
                    <table width="100%" border=0 cellspacing=0 cellpadding=0>
                        <Tr>
                            <Td>
                                <input name="identificador" value="" size="14" maxlength="10" class="CampoTexto1" numero
                                    nome="P. de Instala  o">
                                <input type="button" name="BotaoIdentificador"
                                    title="Consultar pelo Parceiro de Neg cio" value="Buscar" class="botao1"
                                    style="HEIGHT: 18px; width:60px">&nbsp;
                            </Td>
                            <Th>Equipamento:&nbsp;</Th>
                            <Td>
                                <input type="text" name="num_disp" id="num_disp" value="" size="14" maxlength="9"
                                    class="CampoTexto1">
                                <input type="button" name="BotaoEquipamento"
                                    title="Consultar pelo N mero do Equipamento" value="Buscar" class="botao1"
                                    style="HEIGHT: 18px; width:60px">&nbsp;
                            </Td>
                            <Th>Transformador:&nbsp;</Th>
                            <Td>
                                <input type="text" name="trafo" id="trafo" readonly value="" size="14" maxlength="12"
                                    class="CampoTexto1">
                                <input type="button" name="btnTrafo" title="Consultar Transformador" value="Buscar"
                                    class="botao1" onClick="buscaTrafo()" style="HEIGHT: 18px; width:60px">&nbsp;
                            </Td>
                        </Tr>
                    </table>
                </Td>
            </Tr>

            <Tr>
                <td height="10"></td>
            </Tr>
            <Tr>
                <Th>Rua/Av.:</Th>
                <Td><input name="endereco" value="" size="42" maxlength="22" class="CampoTexto1" alphanum
                        nome="Rua/Av."></Td>
                <Th>N mero:</Th>
                <Td><input name="numEndereco" id="numEndereco" value="" size="6" maxlength="5" class="CampoTexto1"
                        numero "N mero"></Td>
                <Th>Bairro:</Th>
                <Td><input value="" name="bairro" size="22" maxlength="20" class="CampoTexto1"
                        onKeyUp="FormataTexto2(this);" style="TEXT-TRANSFORM: uppercase"></Td>
            </Tr>
            <Tr>
                <Th>Refer ncia:</Th>
                <Td><input name="referencia" value="" class="CampoTexto1" size="42" maxlength="40" alphanum
                        nome="Refer ncia"></Td>
                <Th>Compl.:</Th>
                <Td><input name="compl" value="" size="8" maxlength="6" class="CampoTexto1" alphanum></Td>
                <Th>DDD/Telefone:</Th>
                <Td>
                    <input name="ddd" size="3" maxlength="2" class="CampoTexto1" numero>
                    <input name="telefone" size="10" maxlength="9" class="CampoTexto1" numero>
                </Td>
            </Tr>

            <Tr>
                <Th>Unidade Leitura:</Th>
                <Td><input name="unidadeLeitura" id="unidadeLeitura" value="" size="10" maxlength="8"
                        class="CampoTexto1" numero></Td>
                <Th>Sequencia Leitura:</Th>
                <Td><input name="sequencialeitura" id="sequencialeitura" value="" size="6" maxlength="5"
                        class="CampoTexto1" numero></Td>
                <Th align="right">Servi o Origem:</Th>
                <Td colspan="3"><input name="servicoorigem" id="servicoorigem" size="12" maxlength="10"
                        class="CampoTexto1" numero></Td>
            </tr>
            <tr>
                <Th>Ramo Neg cio</Th>
                <Td><input name="ramoNegocio" id="ramoNegocio" value="" size="6" maxlength="5" class="CampoTexto1"></Td>
                <Th align="right">Manobra Vinculada:</Th>
                <Td colspan="3"><input name="manobravinculada" id="manobravinculada" size="12" maxlength="10"
                        class="CampoTexto1" numero></Td>
            </Tr>
            <Tr>
                <Th>Tipo Servi o:</Th>
                <Td colspan=5>
                    <Select Name=tiposerv id=tiposerv class=Combo1 style="width:650px;" requerido nome="Tipo Servi o">
                        <Option value=""></Option>
                        <Option value="NSFN">MANUTENCAO DE REDE E COMUNICACAO FAN</Option>
                        <Option value="NSVI">NOTA DE SERVI O VERIFICAR MEDIDORES INVE</Option>
                        <Option value="NSAC">NS AUDITORIA CORTE/LIG</Option>
                        <Option value="NSAE">NS AUDITORIA EXPANSAO</Option>
                        <Option value="NSAL">NS AUDITORIA ILUMINACAO</Option>
                        <Option value="NSAO">NS AUDITORIA OPERACAO</Option>
                        <Option value="NSAP">NS AUDITORIA PERDAS/INSP</Option>
                        <Option value="NSDM">NS COLETAR DADOS DE MEDICAO</Option>
                        <Option value="NSCP">NS COORDENACAO DE PROTECAO</Option>
                        <Option value="NSUR">NS DE URGENCIA EM TRAFO</Option>
                        <Option value="NSVT">NS DE VARIACAO DE TENSAO</Option>
                        <Option value="NSVE">NS DE VERIFICACAO EM EQPTO</Option>
                        <Option value="NSVR">NS DE VERIFICACAO EM TRAFO</Option>
                        <Option value="NSIN">NS INSPECAO EQTO/TRAFO</Option>
                        <Option value="NSIS">NS INTERVENCAO NO SISTEMA</Option>
                        <Option value="NSLC">NS LEITURA DO CONJUNTO DE MEDICAO</Option>
                        <Option value="NSLP">NS LEITURA DO PORTICO</Option>
                        <Option value="NSLV">NS LINHA ENERGIZADA</Option>
                        <Option value="NSMC">NS MANUTENCAO CORRETIVA</Option>
                        <Option value="NSMP">NS MANUTENCAO PREVENTIVA</Option>
                        <Option value="NSPR">NS MANUTENCAO PROGRAMADA</Option>
                        <Option value="NSMT">NS MANUTENCAO TELECONTROLE</Option>
                        <Option value="NSCJ">NS MANUTENCAO TELEMED RELIGADOR/CONJUN.</Option>
                        <Option value="NSPO">NS MANUTENCAO TELEMEDICAO PORTICO</Option>
                        <Option value="NSPC">NS PREPOSTO DE CORTE E RELIGACAO</Option>
                        <Option value="NSPI">NS PREPOSTO INSPECAO UNIDADES CONSUMIDOR</Option>
                        <Option value="NSRM">NS RETIRAR MEDICAO</Option>
                        <Option value="NSRC">NS RETIRAR MEDICAO COMPROBATORIA</Option>
                        <Option value="NSRI">NS RISCO COM TERCEIROS</Option>
                        <Option value="NSSB">NS SERVICO SUBTERRANEO</Option>
                        <Option value="NSSR">NS SUBSTITUIR RAMAL</Option>
                        <Option value="NSTM">NS TRIAGEM DE MEDIDOR</Option>
                        <Option value="NSGM">TROCA EQPTO COM GARANTIA P/ FORNECEDOR</Option>

                    </Select>
                </Td>
            </Tr>
            <Tr>
                <Th>Servi o a ser Executado:</Th>
                <Td colspan=5><textarea name="Desc_Serv" id="Desc_Serv" class="CampoTexto1" cols="100" rows="3"
                        onKeyDown="return TamanhoMaximo(this,160);" onKeyUp="TamanhoMaximo2(this, 160);"
                        onKeyPress="return FormataTexto3();" style="TEXT-TRANSFORM: uppercase"></textarea></td>
            </Tr>
            <Tr>
                <Th>Observa o:</Th>
                <Td colspan=5>
                    <textarea name="Observ" class="CampoTexto1" cols="100" rows="3"
                        onKeyDown="return TamanhoMaximo(this,160);" onKeyUp="TamanhoMaximo2(this, 160);"
                        onKeyPress="return FormataTexto3();" style="TEXT-TRANSFORM: uppercase"></textarea>
                </Td>
            </Tr>
            <Tr>
                <Th>Recursos Necess rios:</Th>
                <Td colspan=5><textarea name="recur" class="CampoTexto1" cols="100" rows="3"
                        onKeyDown="return TamanhoMaximo(this,120);" onKeyUp="TamanhoMaximo2(this, 120);"
                        onKeyPress="return FormataTexto3();" style="TEXT-TRANSFORM: uppercase"></textarea></Td>
            </Tr>
            <Tr>
                <Th>Executor:</Th>
                <Td>
                    <Select name=Projeta id=Projeta class=Combo1 requerido nome="Executor">
                        <Option value=""></Option>
                        <Option value="E">COD</Option>
                        <Option value="R">REGI O</Option>
                    </Select>
                </Td>
                <Th>Tipo de Turma:</Th>
                <Td>
                    <Select name="TipoTurma" class=Combo1 requerido nome="Tipo de Turma">
                        <Option value=""></Option>
                        <Option value="U">UMPLA</Option>
                        <Option value="M">MOTOCICLISTA</Option>
                        <Option value="D">DUPLA</Option>
                        <Option value="Q">QUARTETO</Option>
                        <Option value="T">TRIO</Option>
                        <Option value="P">PESADA</Option>
                        <Option value="L">LIMP. DE FAIXA</Option>
                        <Option value="O">PODA LEVE</Option>
                        <Option value="V">LINHA VIVA</Option>
                    </Select>
                </Td>
                <Th align="right">Referencia 1:</Th>
                <Td colspan="3"><input name="referencia1" id="referencia1" size="35" maxlength="30" class="CampoTexto1">
                </Td>
            </Tr>
            <Tr>
                <Th>Solicitante:</Th>
                <Td><input name="solicit" value="MATHEUS DE O" requerido nome="Solicitante" size="15" maxlength="12"
                        onKeyUp="FormataTexto2(this);" class="CampoTexto1" style="TEXT-TRANSFORM: uppercase"></Td>
                <Th nowrap>Barramento do Trafo:</Th>
                <Td>
                    <select name="Barra" class="Combo1">
                        <Option value=""></Option>
                        <option Value="C">CONVENCIONAL</option>
                        <option Value="B">TERMINAL BARRA</option>
                    </select>
                </Td>
            </Tr>
            <Tr>
                <Th>Transferir Hor rio do Servi o</Th>
                <Td>
                    <Select name="transHor" class=Combo1 Disabled>
                        <Option value=""></Option>
                        <Option value="S">SIM</Option>
                        <Option value="N">N O</Option>
                    </Select>
                </Td>
                <Th>Agendamento:</Th>
                <Td><input name="Agend" id="Agend" class="CampoTexto1" size="12" maxlength="10" data nome="Agendamento">
                </Td>
                <Th align="right">Referencia 2:</Th>
                <Td colspan="3"><input name="referencia2" id="referencia2" size="35" maxlength="30" class="CampoTexto1">
                </Td>
            </Tr>
            <Tr>
                <Th>Local de F cil Acesso</Th>
                <Td>
                    <Select name="facilacesso" class=Combo1>
                        <Option value=""></Option>
                        <Option value="S">SIM</Option>
                        <Option value="N">N O</Option>
                    </Select>
                </Td>
                <Th>Chave Deslocada</Th>
                <Td>
                    <Select name="chave" class=Combo1>
                        <Option value=""></Option>
                        <Option value="D">DESLOCADA</Option>
                        <Option value="T">NO TRAFO</Option>
                    </Select>
                </Td>
                <Th align="right">Local defeito:</Th>
                <Td colspan="3"><input name="local_defeito" id="local_defeito" size="35" maxlength="30"
                        class="CampoTexto1"></Td>
            </Tr>
            <Tr>
                <Th>Execu o imediata?</Th>
                <Td>
                    <Select name="execucao_imediata" id="execucao_imediata" class=Combo1>
                        <Option value=""></Option>
                        <Option value="S">SIM</Option>
                        <Option value="N">N O</Option>
                    </Select>
                </Td>
                <Th></Th>
                <Td></Td>
                <Th align="right"></Th>
                <Td colspan="3"></Td>
            </Tr>
            <tr>
                <td height="10"></td>
            </tr>
        </Table>
        <p Align="Center">
            <input type="button" value="Cadastrar" id="inserir" name="inserir" class="Botao1"
                onClick="return ChecaDados();">
            <Input type="Button" name="btoLimpar" value="Limpar" class="Botao1" onClick="LimparCampos()">
            <Input type="Button" name="btoVoltar" value="Voltar" class="Botao1" onClick="javascript:self.close();">
        </p>
        <iframe name="iframeComandos" id="iframeComandos" style="display:none"></iframe>
        <input type="hidden" value="" name="IncluirNota">
        <input type="hidden" name="Numserv" value="">
        <input type="hidden" name="matricula" value="">
        <input type="hidden" name="horariorc" value="">
        <input type="hidden" name="dh_sol" value="">
        <input type="hidden" name="nome_cons" value="">
        <input type="hidden" name="classe" value="">
        <input type="hidden" name="subclasse" value="">
        <input type="hidden" name="cod_tip_area" value="">
        <input type="hidden" name="cep" value="">
        <input type="hidden" name="numfases" value="">
        <input type="hidden" name="disjuntor" value="">
        <input type="hidden" name="tipolg" value="">
        <input type="hidden" name="compl2" value="">
        <input type="hidden" name="numDisp" value="">
        <input type="hidden" name="codDisp" value="">
        <input type="hidden" name="fasesTrafo" value="">
        <input type="hidden" name="potenciaTrafo" value="">
        <input type="hidden" name="posicaoUTM">
        <input type="hidden" name="hdnLocal" value="">

    </form>

    <div id="ajaxContainer" style="display:none"></div>

</body>

</html>