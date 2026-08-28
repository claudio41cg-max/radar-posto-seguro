#!/usr/bin/env python3
"""Atualiza cadastro e preços oficiais da ANP para postos do Rio de Janeiro."""

from __future__ import annotations

import io
import json
import re
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

REGISTRY_URL = (
    "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/"
    "arquivos-dados-cadastrais-dos-revendedores-varejistas-de-combustiveis-automotivos/"
    "dados-cadastrais-revendedores-varejistas-combustiveis-automoveis.csv"
)
PRICES_PAGE = (
    "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/"
    "precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas"
)
OUTPUT = Path("data/postos-anp-rio.json")
HEADERS = {"User-Agent": "Radar-Seguro-RJ-Pro/1.0 (dados publicos ANP)"}


def download(url: str) -> bytes:
    response = requests.get(url, headers=HEADERS, timeout=90)
    response.raise_for_status()
    return response.content


def latest_station_prices_url() -> str:
    html = download(PRICES_PAGE).decode("utf-8", errors="replace")
    soup = BeautifulSoup(html, "html.parser")
    for link in soup.find_all("a", href=True):
        text = " ".join(link.get_text(" ", strip=True).split()).lower()
        href = link["href"]
        if "preços por posto revendedor" in text and href.endswith(".xlsx"):
            return requests.compat.urljoin(PRICES_PAGE, href)
    raise RuntimeError("Planilha semanal de preços por posto não encontrada")


def clean_cnpj(value: object) -> str:
    digits = re.sub(r"\D", "", str(value))
    return digits.zfill(14)[-14:]


def main() -> None:
    registry_bytes = download(REGISTRY_URL)
    registry = pd.read_csv(
        io.BytesIO(registry_bytes),
        sep=";",
        dtype=str,
        keep_default_na=False,
        encoding="utf-8-sig",
    )
    registry = registry[
        (registry["UF"].str.upper() == "RJ")
        & (registry["MUNICIPIO"].str.upper() == "RIO DE JANEIRO")
    ].copy()

    if len(registry) < 400:
        raise RuntimeError(
            f"Validação falhou: somente {len(registry)} postos no cadastro do Rio"
        )

    prices_url = latest_station_prices_url()
    prices = pd.read_excel(
        io.BytesIO(download(prices_url)),
        header=9,
        dtype=str,
        keep_default_na=False,
    )
    required = {
        "CNPJ",
        "MUNICÍPIO",
        "ESTADO",
        "PRODUTO",
        "PREÇO DE REVENDA",
        "DATA DA COLETA",
        "UNIDADE DE MEDIDA",
    }
    missing = required.difference(prices.columns)
    if missing:
        raise RuntimeError(f"Colunas ausentes na planilha de preços: {sorted(missing)}")

    prices = prices[
        (prices["ESTADO"].str.upper() == "RIO DE JANEIRO")
        & (prices["MUNICÍPIO"].str.upper() == "RIO DE JANEIRO")
    ].copy()

    price_map: dict[str, dict[str, dict[str, str]]] = {}
    for _, row in prices.iterrows():
        cnpj = clean_cnpj(row["CNPJ"])
        raw_date = str(row["DATA DA COLETA"]).strip()
        date = raw_date[:10]
        price_map.setdefault(cnpj, {})[str(row["PRODUTO"]).strip()] = {
            "value": str(row["PREÇO DE REVENDA"]).strip(),
            "date": date,
            "unit": str(row["UNIDADE DE MEDIDA"]).strip(),
        }

    output = []
    for _, row in registry.iterrows():
        cnpj = clean_cnpj(row["CNPJ"])
        output.append(
            {
                "cnpj": cnpj,
                "legalName": row["RAZAOSOCIAL"].strip(),
                "address": row["ENDERECO"].strip(),
                "complement": row["COMPLEMENTO"].strip(),
                "district": row["BAIRRO"].strip(),
                "zip": row["CEP"].strip(),
                "brand": row["BANDEIRA"].strip() or "BANDEIRA BRANCA",
                "authorization": row["AUTORIZACAO"].strip(),
                "prices": price_map.get(cnpj, {}),
            }
        )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(
        f"Atualizados {len(output)} postos; "
        f"{sum(bool(item['prices']) for item in output)} com preços pesquisados"
    )
    print(f"Fonte de preços: {prices_url}")


if __name__ == "__main__":
    main()
