import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Calculator, Calendar, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { motion } from 'framer-motion';

type RatesByDate = Record<string, Record<string, number>>;

type Language = 'pl' | 'en';

type CalculationResult = {
  amount?: number;
  vat?: number;
  foreignRate?: number;
  homeRate?: number;
  amountInEur?: number;
  netInHome?: number;
  vatInHome?: number;
  grossInHome?: number;
  homePerDocumentRate?: number;
  vatAndRateCombined?: string;
  error?: string;
};

type SelfTest = {
  name: string;
  input: {
    netAmount: string;
    vatRate: string;
    foreignCurrency: string;
    homeCurrency: string;
    ratesByDate: RatesByDate;
    selectedRateDate: string;
    language: Language;
  };
  expectVat?: number;
  expectError?: string;
  expectVatAndRateCombined?: string;
};

const CURRENCIES = [
  'EUR', 'USD', 'PLN', 'GBP', 'CHF', 'CZK', 'HUF', 'SEK', 'NOK', 'DKK', 'RON', 'BGN',
  'JPY', 'CAD', 'AUD', 'NZD', 'CNY', 'HKD', 'SGD', 'KRW', 'INR', 'MXN', 'BRL', 'ZAR',
  'TRY', 'ILS', 'PHP', 'THB', 'MYR', 'IDR',
];

const translations = {
  pl: {
    title: 'Kalkulator VAT wg kursu EBC',
    netAmountDocument: 'Kwota netto dokumentu',
    vatRate: 'Stawka VAT (%)',
    documentCurrency: 'Waluta dokumentu',
    homeCurrency: 'Waluta domowa',
    exchangeRateDate: 'Data kursu',
    selectCurrency: 'Wybierz walutę',
    refresh: 'Odśwież',
    result: 'Wynik',
    inputError: 'Błąd danych wejściowych',
    fetchErrorTitle: 'Błąd pobierania danych',
    completeData: 'Uzupełnij dane',
    appliedRateDate: 'Zastosowany dzień kursu',
    noPublicationFallback: (selectedDate: string, selectedRateDate: string) =>
      `Dla dnia ${selectedDate} brak publikacji EBC, więc użyto ostatniego dostępnego kursu z dnia ${selectedRateDate}.`,
    directPublication: (selectedRateDate: string) =>
      `Użyto kursu z dnia ${selectedRateDate}.`,
    netInHome: 'Netto w walucie domowej',
    vatInHome: 'VAT w walucie domowej',
    grossInHome: 'Brutto w walucie domowej',
    vatRateField: 'VAT_Kurs',
    rateToEur: (currency: string) => `Kurs ${currency}/EUR:`,
    source: 'Źródło:',
    notes: 'Uwagi',
    assumptions: 'Założenia zastosowane w aplikacji',
    note1: '• Aplikacja korzysta z kursów referencyjnych EBC udostępnianych przez Frankfurter API.',
    note2: '• Kursy EBC są notowane względem EUR, więc każde przeliczenie przebiega przez EUR.',
    note3: '• Gdy dla wybranego dnia nie ma publikacji, używany jest ostatni wcześniejszy dostępny kurs.',
    note4: '• Zakres pobrania obejmuje ostatnie maks. 120 dni do wybranej daty.',
    note5: '• Automatyczne odświeżanie działa codziennie o 16:30 CET dla bieżącej daty, gdy strona jest otwarta.',
    note6: '• Wzór: netto w EUR = netto w walucie dokumentu ÷ kurs waluty dokumentu; netto w walucie domowej = netto w EUR × kurs waluty domowej; VAT = netto w walucie domowej × stawka VAT; kurs w polu VAT_Kurs = liczba jednostek waluty domowej za 1 jednostkę waluty dokumentu.',
    sourceValue: 'Frankfurter API (kursy referencyjne EBC)',
    futureDate: 'Wybrana data pochodzi z przyszłości',
    invalidNetAmount: 'Podaj poprawną kwotę netto większą od zera.',
    invalidVatRate: 'Podaj poprawną stawkę VAT.',
    noRateForDate: 'Brak kursu EBC dla wskazanej daty lub wcześniejszego dnia.',
    noRateDataForDay: 'Brak danych kursowych dla wybranego dnia.',
    noCurrencyForDay: (currency: string, date: string) =>
      `Waluta ${currency} nie jest dostępna dla dnia ${date}.`,
    noDataInRange: 'Brak danych kursowych dla wskazanego zakresu.',
    fetchFailed: 'Nie udało się pobrać kursów.',
    httpError: (status: number) => `Błąd HTTP ${status}`,
    testsFailed: 'Niepowodzenie testów kalkulatora VAT:',
    languagePL: 'Polski',
    languageEN: 'English',
  },
  en: {
    title: 'VAT Calculator based on ECB exchange rate',
    netAmountDocument: 'Document net amount',
    vatRate: 'VAT rate (%)',
    documentCurrency: 'Document currency',
    homeCurrency: 'Home currency',
    exchangeRateDate: 'Exchange rate date',
    selectCurrency: 'Select currency',
    refresh: 'Refresh',
    result: 'Result',
    inputError: 'Input data error',
    fetchErrorTitle: 'Data download error',
    completeData: 'Complete the required fields',
    appliedRateDate: 'Applied exchange rate date',
    noPublicationFallback: (selectedDate: string, selectedRateDate: string) =>
      `No ECB rate was published for ${selectedDate}, so the latest available rate from ${selectedRateDate} was used.`,
    directPublication: (selectedRateDate: string) =>
      `Rate from ${selectedRateDate} was used.`,
    netInHome: 'Net amount in home currency',
    vatInHome: 'VAT in home currency',
    grossInHome: 'Gross amount in home currency',
    vatRateField: 'VAT_Rate',
    rateToEur: (currency: string) => `Rate ${currency}/EUR:`,
    source: 'Source:',
    notes: 'Notes',
    assumptions: 'Assumptions used in the application',
    note1: '• The application uses ECB reference rates provided by the Frankfurter API.',
    note2: '• ECB rates are quoted against EUR, so every conversion goes through EUR.',
    note3: '• If no rate is published for the selected day, the latest earlier available rate is used.',
    note4: '• The downloaded range covers up to the last 120 days up to the selected date.',
    note5: '• Automatic refresh runs daily at 16:30 CET for the current date while the page is open.',
    note6: '• Formula: amount in EUR = document net amount ÷ document currency rate; net amount in home currency = amount in EUR × home currency rate; VAT = net amount in home currency × VAT rate; the rate in the VAT_Rate field = number of home currency units for 1 unit of the document currency.',
    sourceValue: 'Frankfurter API (ECB reference rates)',
    futureDate: 'The selected date is in the future',
    invalidNetAmount: 'Enter a valid net amount greater than zero.',
    invalidVatRate: 'Enter a valid VAT rate.',
    noRateForDate: 'No ECB rate is available for the selected date or any earlier date.',
    noRateDataForDay: 'No rate data is available for the selected day.',
    noCurrencyForDay: (currency: string, date: string) =>
      `Currency ${currency} is not available for ${date}.`,
    noDataInRange: 'No exchange rate data is available for the selected range.',
    fetchFailed: 'Failed to download exchange rates.',
    httpError: (status: number) => `HTTP error ${status}`,
    testsFailed: 'VAT calculator self-tests failed:',
    languagePL: 'Polski',
    languageEN: 'English',
  },
} as const;

function formatNumber(value: number | undefined, currency: string) {
  if (value === undefined || !Number.isFinite(value)) return '—';

  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

function formatRate(value: number | undefined, digits = 6, useGrouping = true) {
  if (value === undefined || !Number.isFinite(value)) return '—';

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping,
  }).format(value);
}

function formatPlainAmount(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return '—';

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value);
}

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDecimal(value: string) {
  return Number(String(value).replace(',', '.').trim());
}

function isFutureDate(dateString: string) {
  if (!dateString) return false;
  return dateString > todayString();
}

function msUntilNextDailyRefreshAt1630CET() {
  const now = new Date();
  const nowInCetMs = now.getTime() + 60 * 60 * 1000;
  const nowInCet = new Date(nowInCetMs);
  const targetInCet = new Date(nowInCetMs);

  targetInCet.setUTCHours(16, 30, 0, 0);

  if (nowInCet >= targetInCet) {
    targetInCet.setUTCDate(targetInCet.getUTCDate() + 1);
  }

  return targetInCet.getTime() - nowInCetMs;
}

function findClosestRateDate(ratesByDate: RatesByDate, selectedDate: string) {
  const dates = Object.keys(ratesByDate).sort();
  if (!dates.length || !selectedDate) return '';

  let candidate = '';
  for (const date of dates) {
    if (date <= selectedDate) candidate = date;
    if (date > selectedDate) break;
  }

  return candidate;
}

function calculateVatInHomeCurrency({
  netAmount,
  vatRate,
  foreignCurrency,
  homeCurrency,
  ratesByDate,
  selectedRateDate,
  language,
}: {
  netAmount: string;
  vatRate: string;
  foreignCurrency: string;
  homeCurrency: string;
  ratesByDate: RatesByDate;
  selectedRateDate: string;
  language: Language;
}): CalculationResult {
  const t = translations[language];
  const amount = parseDecimal(netAmount);
  const vat = parseDecimal(vatRate);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: t.invalidNetAmount };
  }

  if (!Number.isFinite(vat) || vat < 0) {
    return { error: t.invalidVatRate };
  }

  if (!selectedRateDate) {
    return { error: t.noRateForDate };
  }

  const rates = ratesByDate[selectedRateDate];
  if (!rates) {
    return { error: t.noRateDataForDay };
  }

  const foreignRate = rates[foreignCurrency];
  const homeRate = rates[homeCurrency];

  if (!foreignRate) {
    return { error: t.noCurrencyForDay(foreignCurrency, selectedRateDate) };
  }

  if (!homeRate) {
    return { error: t.noCurrencyForDay(homeCurrency, selectedRateDate) };
  }

  const amountInEur = foreignCurrency === 'EUR' ? amount : amount / foreignRate;
  const netInHome = homeCurrency === 'EUR' ? amountInEur : amountInEur * homeRate;
  const vatInHome = netInHome * (vat / 100);
  const grossInHome = netInHome + vatInHome;
  const homePerDocumentRate = homeRate / foreignRate;
  const vatAndRateCombined = `${formatPlainAmount(vatInHome)}_${formatRate(homePerDocumentRate, 4, false)}`;

  return {
    amount,
    vat,
    foreignRate,
    homeRate,
    amountInEur,
    netInHome,
    vatInHome,
    grossInHome,
    homePerDocumentRate,
    vatAndRateCombined,
  };
}

const SELF_TESTS: SelfTest[] = [
  {
    name: 'USD -> PLN conversion through EUR',
    input: {
      netAmount: '100',
      vatRate: '23',
      foreignCurrency: 'USD',
      homeCurrency: 'PLN',
      selectedRateDate: '2026-03-13',
      ratesByDate: {
        '2026-03-13': { EUR: 1, USD: 1.1, PLN: 4.4 },
      },
      language: 'en',
    },
    expectVat: 92,
    expectVatAndRateCombined: '92.00_4.0000',
  },
  {
    name: 'Same currency EUR -> EUR',
    input: {
      netAmount: '100',
      vatRate: '23',
      foreignCurrency: 'EUR',
      homeCurrency: 'EUR',
      selectedRateDate: '2026-03-13',
      ratesByDate: {
        '2026-03-13': { EUR: 1, USD: 1.1, PLN: 4.4 },
      },
      language: 'en',
    },
    expectVat: 23,
    expectVatAndRateCombined: '23.00_1.0000',
  },
  {
    name: 'Invalid net amount validation',
    input: {
      netAmount: '0',
      vatRate: '23',
      foreignCurrency: 'EUR',
      homeCurrency: 'PLN',
      selectedRateDate: '2026-03-13',
      ratesByDate: {
        '2026-03-13': { EUR: 1, PLN: 4.4 },
      },
      language: 'en',
    },
    expectError: translations.en.invalidNetAmount,
  },
  {
    name: 'VAT_Rate as home currency units for 1 document currency unit',
    input: {
      netAmount: '100',
      vatRate: '10',
      foreignCurrency: 'USD',
      homeCurrency: 'PLN',
      selectedRateDate: '2026-03-13',
      ratesByDate: {
        '2026-03-13': { EUR: 1, USD: 1.2, PLN: 4.8 },
      },
      language: 'en',
    },
    expectVat: 40,
    expectVatAndRateCombined: '40.00_4.0000',
  },
  {
    name: 'Comma in net amount',
    input: {
      netAmount: '100,50',
      vatRate: '20',
      foreignCurrency: 'EUR',
      homeCurrency: 'PLN',
      selectedRateDate: '2026-03-13',
      ratesByDate: {
        '2026-03-13': { EUR: 1, PLN: 4.0 },
      },
      language: 'en',
    },
    expectVat: 80.4,
    expectVatAndRateCombined: '80.40_4.0000',
  },
  {
    name: 'VAT_Rate without thousands separators',
    input: {
      netAmount: '12500',
      vatRate: '20',
      foreignCurrency: 'EUR',
      homeCurrency: 'PLN',
      selectedRateDate: '2026-03-13',
      ratesByDate: {
        '2026-03-13': { EUR: 1, PLN: 4.0 },
      },
      language: 'en',
    },
    expectVat: 10000,
    expectVatAndRateCombined: '10000.00_4.0000',
  },
];

function runSelfTests() {
  return SELF_TESTS.map((test) => {
    const result = calculateVatInHomeCurrency(test.input);

    if (test.expectError) {
      return {
        name: test.name,
        passed: result.error === test.expectError,
      };
    }

    const vatPassed = Math.abs((result.vatInHome ?? 0) - (test.expectVat ?? 0)) < 0.0001;
    const combinedPassed = test.expectVatAndRateCombined
      ? result.vatAndRateCombined === test.expectVatAndRateCombined
      : true;

    return { name: test.name, passed: vatPassed && combinedPassed };
  });
}

function assertSelfTests(language: Language) {
  const results = runSelfTests();
  const failed = results.filter((test) => !test.passed);

  if (failed.length > 0) {
    console.error(translations[language].testsFailed, failed);
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('vat-ebc-language') : null;
    return saved === 'en' ? 'en' : 'pl';
  });
  const [netAmount, setNetAmount] = useState('1000');
  const [vatRate, setVatRate] = useState('23');
  const [foreignCurrency, setForeignCurrency] = useState('EUR');
  const [homeCurrency, setHomeCurrency] = useState('PLN');
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [ratesByDate, setRatesByDate] = useState<RatesByDate>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceInfo, setSourceInfo] = useState('');

  const t = translations[language];

  useEffect(() => {
    window.localStorage.setItem('vat-ebc-language', language);
  }, [language]);

  const fetchRates = async () => {
    if (isFutureDate(selectedDate)) {
      setRatesByDate({});
      setSourceInfo('');
      setError(t.futureDate);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const endDate = selectedDate || todayString();
      const start = new Date(`${endDate}T00:00:00`);
      start.setDate(start.getDate() - 120);
      const startDate = start.toISOString().slice(0, 10);

      const response = await fetch(`https://api.frankfurter.app/${startDate}..${endDate}`);
      if (!response.ok) {
        throw new Error(t.httpError(response.status));
      }

      const data = (await response.json()) as { rates?: Record<string, Record<string, number>> };
      if (!data.rates || Object.keys(data.rates).length === 0) {
        throw new Error(t.noDataInRange);
      }

      const nextRatesByDate: RatesByDate = {};
      Object.entries(data.rates).forEach(([date, dayRates]) => {
        nextRatesByDate[date] = {
          EUR: 1,
          ...dayRates,
        };
      });

      setRatesByDate(nextRatesByDate);
      setSourceInfo(t.sourceValue);
    } catch (fetchError) {
      setRatesByDate({});
      setSourceInfo('');
      setError(fetchError instanceof Error ? fetchError.message : t.fetchFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    assertSelfTests(language);
  }, [language]);

  useEffect(() => {
    fetchRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedDate !== todayString()) {
      return undefined;
    }

    let timeoutId: number | undefined;

    const scheduleNextRefresh = () => {
      const delay = msUntilNextDailyRefreshAt1630CET();

      timeoutId = window.setTimeout(async () => {
        await fetchRates();
        scheduleNextRefresh();
      }, delay);
    };

    scheduleNextRefresh();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, language]);

  const selectedRateDate = useMemo(
    () => findClosestRateDate(ratesByDate, selectedDate),
    [ratesByDate, selectedDate]
  );

  const futureDateError = useMemo(
    () => (isFutureDate(selectedDate) ? t.futureDate : ''),
    [selectedDate, t]
  );

  const calculation = useMemo(
    () =>
      calculateVatInHomeCurrency({
        netAmount,
        vatRate,
        foreignCurrency,
        homeCurrency,
        ratesByDate,
        selectedRateDate,
        language,
      }),
    [netAmount, vatRate, foreignCurrency, homeCurrency, ratesByDate, selectedRateDate, language]
  );

  const isFallbackRate = Boolean(selectedRateDate) && selectedRateDate !== selectedDate;
  const rateAlertClassName = isFallbackRate ? 'border-yellow-200 bg-yellow-50 text-yellow-900' : '';
  const rateAlertIconClassName = isFallbackRate ? 'h-4 w-4 text-yellow-700' : 'h-4 w-4';

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <Calculator className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{t.title}</CardTitle>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={language === 'pl' ? 'default' : 'outline'}
                    onClick={() => setLanguage('pl')}
                  >
                    {t.languagePL}
                  </Button>
                  <Button
                    type="button"
                    variant={language === 'en' ? 'default' : 'outline'}
                    onClick={() => setLanguage('en')}
                  >
                    {t.languageEN}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="net">{t.netAmountDocument}</Label>
                <Input
                  id="net"
                  value={netAmount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNetAmount(e.target.value)}
                  placeholder="Np. 1000.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vat">{t.vatRate}</Label>
                <Input
                  id="vat"
                  value={vatRate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setVatRate(e.target.value)}
                  placeholder="Np. 23"
                />
              </div>

              <div className="space-y-2">
                <Label>{t.documentCurrency}</Label>
                <Select value={foreignCurrency} onValueChange={setForeignCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.selectCurrency} />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t.homeCurrency}</Label>
                <Select value={homeCurrency} onValueChange={setHomeCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.selectCurrency} />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="date">{t.exchangeRateDate}</Label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
                    <Input
                      id="date"
                      type="date"
                      className="pl-10"
                      value={selectedDate}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" onClick={fetchRates} disabled={loading} className="min-w-32">
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    {t.refresh}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>{t.result}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {futureDateError ? (
                <Alert className="border-red-200 bg-red-50 text-red-900">
                  <AlertCircle className="h-4 w-4 text-red-700" />
                  <AlertTitle>{t.inputError}</AlertTitle>
                  <AlertDescription>{futureDateError}</AlertDescription>
                </Alert>
              ) : error ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t.fetchErrorTitle}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : calculation.error ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t.completeData}</AlertTitle>
                  <AlertDescription>{calculation.error}</AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert className={rateAlertClassName}>
                    <CheckCircle2 className={rateAlertIconClassName} />
                    <AlertTitle>{t.appliedRateDate}</AlertTitle>
                    <AlertDescription>
                      {isFallbackRate
                        ? t.noPublicationFallback(selectedDate, selectedRateDate)
                        : t.directPublication(selectedRateDate)}
                    </AlertDescription>
                  </Alert>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Metric label={t.netInHome} value={formatNumber(calculation.netInHome, homeCurrency)} />
                    <Metric label={t.vatInHome} value={formatNumber(calculation.vatInHome, homeCurrency)} />
                    <Metric label={t.grossInHome} value={formatNumber(calculation.grossInHome, homeCurrency)} />
                    <Metric label={t.vatRateField} value={calculation.vatAndRateCombined ?? '—'} />
                  </div>

                  <div className="rounded-2xl border bg-white p-4 text-sm leading-6">
                    <div>
                      <span className="font-medium">{t.rateToEur(foreignCurrency)}</span>{' '}
                      {formatRate(calculation.foreignRate, 4)}
                    </div>
                    <div>
                      <span className="font-medium">{t.rateToEur(homeCurrency)}</span>{' '}
                      {formatRate(calculation.homeRate, 4)}
                    </div>
                    <div>
                      <span className="font-medium">{t.source}</span> {sourceInfo}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>{t.notes}</CardTitle>
            <CardDescription>{t.assumptions}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
            <p>{t.note1}</p>
            <p>{t.note2}</p>
            <p>{t.note3}</p>
            <p>{t.note4}</p>
            <p>{t.note5}</p>
            <p>{t.note6}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}