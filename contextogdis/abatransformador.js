


// Link para acessar esta pagina é: http://192.168.1.110/contratadaweb/servicos/despachante/det_aten/selecionatrafo.jsp?TelaOrigem=NotaManutencao


<html>
	<head>
		<meta http-equiv="pragma" content="no-cache">
			<title>Seleciona Transformador</title>
			<link rel="StyleSheet" content="text/css" href="/contratadaweb/condis/templates/azul/css/formata.css">

				<style>

					.divConsulta
					{
						BORDER - RIGHT: green 0px solid;
					BORDER-BOTTOM: green 0px solid;
					BORDER-TOP: #f5f5f5 0px solid;
					BORDER-LEFT: #f5f5f5 0px solid;
					PADDING-RIGHT: 0px;
					PADDING-LEFT: 0px;
					PADDING-BOTTOM: 0px;
					PADDING-TOP: 0px;
					DISPLAY: block;
					FONT-SIZE: x-small;
					LEFT: 0px;
					BACKGROUND-IMAGE: none;
					MARGIN: 1px;
					OVERFLOW: auto;
					COLOR: blue;
					FONT-FAMILY: Tahoma, Verdana, Arial;
					POSITION: static;
					BACKGROUND-COLOR: white;
					TEXT-ALIGN: left;
					TEXT-DECORATION: none;
					WIDTH: 100%;
					HEIGHT: 100%;
}

				</style>

				<script language="JavaScript" src="/contratadaweb/biblio/Js/Util.js"></script>
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
						_ip : "http://192.168.122.110/",
					// Desenvolvimento
					_ip2 : "http://10.2.130.72:8280/",
					getSessionId : function(){
			return "C1E1F132B9D156307DDE12E80F4A09BC.PLNJBBHEGDIS08";
		},
					Configuracao :
					{
						getURL : function()
					{
				return Servidor._ip + "WebIntegracaoJava/";
			},

					getURLRelatorio : function()
					{
				return Servidor._ip + "WebRelatorio/";
			},

					getURLApropriacao : function()
					{
				return Servidor._ip + "WebApropriacao/";
			},
					getURLApropriacaoPropria : function()
					{
				return Servidor._ip + "WebApropriacaoPropria/";
			},
					getURLpdaCondisconsulta : function()
					{
				return Servidor._ip + "WebConsultasCondis/";
			},
					getURLRaiz : function()
					{
				return Servidor._ip;
			},
					getURLGestor : function()
					{
				return Servidor._ip2 + "gestorservicos/pages/gestor/gestor.jsf";
			}
		}
	}
					ServidorCONDIS =
					{
						// Desenvolvimento
						_ip : "/contratadaweb",

					Configuracao :
					{
						getURL : function()
					{
				return ServidorCONDIS._ip;
			}
		}
	}
					ServidorPM =
					{
						// Desenvolvimento
						_ip : "http://192.168.122.120/",

					Configuracao :
					{
						getURL : function()
					{
				return ServidorPM._ip + "gdispm/";
			}
		}
	}

				</script>
				<script language="JavaScript" src="/contratadaweb/biblio/Js/IntegracaoJava.js"></script>

				<script language="vbscript">
					window.moveTo (screen.width - 660) / 2, (screen.height - 350) / 2
				</script>

				<Script Language="JSCript">

					var mcAjax;
					var mapFrmRC;

					function Page_Onload()
					{
						mcAjax = new MCAjax();

					mapFrmRC = new MCFormMapping("frmTrafo");
					mapFrmRC.changeFocusOnEnter = false;

					EventManager.addListener($("BotaoConsultar"), {onclick : function()
					{
						BotaoConsultar_Click();
	}});

					EventManager.addListener($("Numero"), {onkeydown : function()
					{
						ValidaNumero();
	}});

					EventManager.addListener($("Numero"), {onkeyup : function()
					{
						ValidaNumero2($('Numero'));
	}});

					$("Numero").focus();
}

					function ListaLocais()
					{
						mcAjax.load("/contratadaweb/condis/concod/atendimento_des/listalocais.jsp?regiao=" + $("regiao").value, $("ajaxContainer")).onComplete = Delegate(this, function (q) {
							if (q.responseData.err.code == 0) {
								if (q.responseData.rows.length > 0) {
									$('local').options.length = 0;

									for (var i = 0; i < q.responseData.rows.length; i++) {
										$('local').options[i] = new Option(q.responseData.rows[i].local + ' - ' + q.responseData.rows[i].descricao, q.responseData.rows[i].descricao);
									}
								}
								else {
									alert(q.responseData.err.message);
								}
							}
							else {
								alert(q.responseData.err.message);
							}
						});	
}

					function rdopcao_onclick(numero, fases, potencia, local)
					{
						IntegracaoJava.consultas.trafoPorFasesPotenciaLocal(numero, fases, potencia, local,
							{
								onSuccess: Delegate(this, function (rows) {
									if (rows.length > 0) {
										var arrayRetorno = rows[0];

										switch ($("TelaOrigem").value) {
											case "LocBase":
												arrayRetorno.Trafo = arrayRetorno.posicaoUTM;
												arrayRetorno.Latitude = arrayRetorno.latitude;
												arrayRetorno.Longitude = arrayRetorno.longitude;
												window.opener.mapFrmRC.setData(arrayRetorno);

												top.close();
												break;

											case "NotaManutencao":

												window.opener.lstselRegiao_onchange("", arrayRetorno.regiao, arrayRetorno.local);
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

												window.opener.mapFrmRC.setData(arrayRetorno);

												top.close();
												break;

											case "SolicitacaoMedicao":

												window.opener.lstselRegiao_onchange("", arrayRetorno.regiao, arrayRetorno.local);
												arrayRetorno.subalim = arrayRetorno.subestacao + arrayRetorno.alimentador;
												arrayRetorno.CodDisp = "01";
												arrayRetorno.trafo = arrayRetorno.numero + "-" + arrayRetorno.numeroFases + "-" + arrayRetorno.potencia;
												arrayRetorno.num_disp = arrayRetorno.numero;
												arrayRetorno.nomelogradouro = arrayRetorno.endereco;
												arrayRetorno.numero = arrayRetorno.numEndereco;
												arrayRetorno.bairro = (arrayRetorno.bairro == null ? "" : arrayRetorno.bairro);

												window.opener.mapFrmRC.setData(arrayRetorno);

												top.close();
												break;

											case "ManobraSimplificada":

												arrayRetorno.Alimentador = (arrayRetorno.subestacao + "    ").substring(0, 4) + arrayRetorno.alimentador;
												arrayRetorno.Cod_Disp = "01";
												arrayRetorno.Num_Equip = arrayRetorno.numero;
												arrayRetorno.Tra_Fas = arrayRetorno.numeroFases;
												arrayRetorno.Tra_Pot = arrayRetorno.potencia;
												arrayRetorno.Num_Log = arrayRetorno.numEndereco;
												arrayRetorno.Local = arrayRetorno.local;
												arrayRetorno.Endereco_Eqp = arrayRetorno.endereco;
												arrayRetorno.hMatricula = arrayRetorno.posicaoUTM;

												window.opener.mapFrmRC.setData(arrayRetorno);

												top.close();
												break;

											case "ItemManobra":

												arrayRetorno.Alimentador = arrayRetorno.subestacao + arrayRetorno.alimentador;
												arrayRetorno.Cod_Disp = "01";
												arrayRetorno.Num_Equip = arrayRetorno.numero;
												arrayRetorno.Tra_Prop = "";
												arrayRetorno.Tra_Fas = arrayRetorno.numeroFases;
												arrayRetorno.Tra_Pot = arrayRetorno.potencia;
												arrayRetorno.Num_Log = arrayRetorno.numEndereco;
												arrayRetorno.Local = arrayRetorno.local;
												arrayRetorno.Endereco_Eqp = arrayRetorno.endereco;
												arrayRetorno.hMatricula = arrayRetorno.posicaoUTM;
												arrayRetorno.tipoTrecho = arrayRetorno.tipoTrecho;

												window.opener.mapFrmRC.setData(arrayRetorno);

												top.close();
												break;

											case "Semaforo":
												arrayRetorno.NumFasesTr = arrayRetorno.numeroFases;
												arrayRetorno.NumeroTr = arrayRetorno.numero;
												arrayRetorno.PotenciaTr = arrayRetorno.potencia;
												arrayRetorno.LocalTr = arrayRetorno.local;
												window.opener.mapFrmRC.setData(arrayRetorno);

												top.close();

												break;
											case "Ocorrencia":

												arrayRetorno.txtTrafo = arrayRetorno.numero + "-" + arrayRetorno.numeroFases + "-" + arrayRetorno.potencia;
												arrayRetorno.txtMatricula = arrayRetorno.posicaoUTM;
												window.opener.mapFrmRC.setData(arrayRetorno);

												top.close();
												break;

											case "PlanoAlerta":
												window.opener.LimpaCamposDispositivos();
												arrayRetorno.tipo = "01";
												arrayRetorno.txtNumEqu = arrayRetorno.numero;
												arrayRetorno.txtFases = arrayRetorno.numeroFases;
												arrayRetorno.txtPotencia = arrayRetorno.potencia;
												arrayRetorno.txtSubesta = arrayRetorno.subestacao;
												arrayRetorno.txtAlimentador = arrayRetorno.alimentador;

												arrayRetorno.txtTipoLog = "";
												arrayRetorno.nomelogradouro = arrayRetorno.endereco;
												arrayRetorno.txtNumLog = arrayRetorno.numEndereco;
												arrayRetorno.txtBairro = (arrayRetorno.bairro == null ? "" : arrayRetorno.bairro);
												arrayRetorno.txtRegiao = arrayRetorno.regiao;
												arrayRetorno.txtLocal = arrayRetorno.local;

												window.opener.mapFrmRC.setData(arrayRetorno);

												top.close();
												break;

											case "ItemContingencia":

												arrayRetorno.Cod_Disp = "01";
												arrayRetorno.Num_Equip = arrayRetorno.numero;
												arrayRetorno.Alimentador = arrayRetorno.subestacao + arrayRetorno.alimentador;
												arrayRetorno.Tra_Fas = arrayRetorno.numeroFases;
												arrayRetorno.Tra_Pot = arrayRetorno.potencia;
												arrayRetorno.Tip_log = "";
												arrayRetorno.Endereco_Eqp = arrayRetorno.endereco;
												arrayRetorno.Num_Log = arrayRetorno.numEndereco;
												arrayRetorno.Bairro = (arrayRetorno.bairro == null ? "" : arrayRetorno.bairro);


												arrayRetorno.Local = arrayRetorno.local;

												window.opener.mapFrmRC.setData(arrayRetorno);

												top.close();
												break;

											case "TeleAlarme":

												arrayRetorno.selCodDisp = "01";
												arrayRetorno.txtEqpto = arrayRetorno.numero;
												arrayRetorno.txtSubAlim = arrayRetorno.subestacao + arrayRetorno.alimentador;
												arrayRetorno.txtTrafo = arrayRetorno.numero + "-" + arrayRetorno.numeroFases + "-" + arrayRetorno.potencia;
												arrayRetorno.hFases = arrayRetorno.numeroFases;
												arrayRetorno.hPotencia = arrayRetorno.potencia;
												arrayRetorno.hMatricula = arrayRetorno.posicaoUTM;
												arrayRetorno.txtEndereco = arrayRetorno.endereco;
												arrayRetorno.txtNumero = arrayRetorno.numEndereco;
												arrayRetorno.txtLocal = arrayRetorno.local;

												window.opener.mapFrmRC.setData(arrayRetorno);

												top.close();
												break;

											case "Interrupcao":

												arrayRetorno.dsp = "01";
												arrayRetorno.num_disp = "";
												arrayRetorno.trafo = arrayRetorno.numero;
												arrayRetorno.fase = arrayRetorno.numeroFases;
												arrayRetorno.potencia = arrayRetorno.potencia;
												arrayRetorno.subalim = arrayRetorno.subestacao + arrayRetorno.alimentador;
												arrayRetorno.endereco_eqp = arrayRetorno.endereco;
												arrayRetorno.numero = arrayRetorno.numEndereco;
												arrayRetorno.Mat_Eqp = arrayRetorno.posicaoUTM;
												arrayRetorno.local = arrayRetorno.local;

												window.opener.mapFrmRC.setData(arrayRetorno);
												window.opener.dsp_onChange("01");

												top.close();
												break;
										}
									}
									else {
										alert("Transformador não encontrado");
									}
								})
							});
}

					function Enter(campo, evento)
					{	
	if(evento==9 || evento==13)
					{
						BotaoConsultar_Click();
	}
}

					function BotaoConsultar_Click()
					{
	if($('Numero').value == "")
					{
						alert("Informe o número do transformador");
					$('Numero').focus();
					return false;
	}

					if($('Superin').value == "")
					{
						alert("Selecione a Malha");
					$('Superin').focus();
					return false;
	}

					IntegracaoJava.consultas.trafoPorMalha($('Numero').value, $('Superin').value,
					{
						onSuccess : Delegate(this, function(rows)
					{
			if (rows.length > 0)
					{		
				var strHTML = "<table width='100%' class='TabelaLista' ><tr><th nowrap></th><th style='text-align:center' nowrap>Trafo</th><th style='text-align:center' nowrap>Alimentador</th><th style='text-align:center' nowrap>Endereço</th><th style='text-align:center' nowrap>Bairro</th><th style='text-align:center' nowrap>Número</th><th style='text-align:center' nowrap>Local</td><th style='text-align:center' nowrap>Região</th></tr>";
						for (var i = 0; i < rows.length; i ++)
						{
							strHTML += "<tr bgcolor=''>";
						strHTML += "	<td><input type='radio' name='rdopcao' id='rdopcao' onclick='rdopcao_onclick(\"" + rows[i].numero + "\"" + ',' + "\"" + rows[i].numeroFases + "\"" + ',' + "\"" + rows[i].potencia + "\"" + ',' + "\"" + rows[i].local + "\"" + ");'></td>";
						strHTML += "	<td nowrap>" + rows[i].numero + '-' + rows[i].numeroFases + '-' + rows[i].potencia + "</td>";
						strHTML += "	<td nowrap>" + rows[i].alimentador + "</td>";
						strHTML += "	<td nowrap>" + rows[i].endereco + "</td>";
						strHTML += "	<td nowrap>" + (rows[i].bairro == null ? "" : rows[i].bairro)  + "</td>";
						strHTML += "	<td nowrap>" + rows[i].numEndereco + "</td>";
						strHTML += "	<td nowrap>" + rows[i].local + "</td>";
						strHTML += "	<td nowrap>" + rows[i].regiao + "</td>";
						strHTML += "</tr>";
				}
					strHTML += "</table>";

				$("resultadoConsultaTrafo").innerHTML = strHTML;
			}
				else
				{
					alert("Trafo não encontrado para a malha " + $('Superin').value);
				$("resultadoConsultaTrafo").innerHTML = "";
			}
		})
	});
}

			</Script>

	</head>
	<body onload="Page_Onload();" leftmargin="0" topmargin="0" scroll="no">
		<form name="frmTrafo" id="frmTrafo">
			<Table width="100%" height="100%" border=0 bordercolor=red Class=TabelaForm>
			<Caption>Seleciona Transformador</Caption>
			<Tr height="15">
				<Th>Transformador:&nbsp;</Th>
				<Td><input name="Numero" id="Numero" tabindex="0" value="" class="CampoTexto1" size="13" maxlength="9" numero onkeypress="ValidaNumero()"></Td>
				<Th>Malha:&nbsp;</Th>
				<Td>
					<select id="Superin" name="Superin" class="combo1" style="width:80px">
						<option value="" selected></option>

						<option value="DC">DC</option>

						<option value="DL" selected>DL</option>

						<option value="DM">DM</option>

						<option value="DN">DN</option>

						<option value="DS">DS</option>

						<option value="DT">DT</option>

					</select>
				</Td>
				<td><input type="button" name="BotaoConsultar" id="BotaoConsultar" value="Buscar" class="Botao1"></Td>
			</Tr>
			<Tr>
				<Td colspan="5">
					<div id="resultadoConsultaTrafo" class="divConsulta"></div>
				</Td>
			</Tr>
		</Table>
		<input type="hidden" id="TelaOrigem" name="TelaOrigem" value="NotaManutencao">
		</form>
		<div id="ajaxContainer" style="display:none" align="center"></div>
	</body>
</html>