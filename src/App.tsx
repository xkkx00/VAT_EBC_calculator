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
}: {
  netAmount: string;
  vatRate: string;
  foreignCurrency: string;
  homeCurrency: string;
  ratesByDate: RatesByDate;
  selectedRateDate: string;
}): CalculationResult {
  const amount = parseDecimal(netAmount);
  const vat = parseDecimal(vatRate);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Podaj poprawną kwotę netto większą od zera.' };
  }

  if (!Number.isFinite(vat) || vat < 0) {
    return { error: 'Podaj poprawną stawkę VAT.' };
  }

  if (!selectedRateDate) {
    return { error: 'Brak kursu EBC dla wskazanej daty lub wcześniejszego dnia.' };
  }

  const rates = ratesByDate[selectedRateDate];
  if (!rates) {
    return { error: 'Brak danych kursowych dla wybranego dnia.' };
  }

  const foreignRate = rates[foreignCurrency];
  const homeRate = rates[homeCurrency];

  if (!foreignRate) {
    return { error: `Waluta ${foreignCurrency} nie jest dostępna dla dnia ${selectedRateDate}.` };
  }

  if (!homeRate) {
    return { error: `Waluta ${homeCurrency} nie jest dostępna dla dnia ${selectedRateDate}.` };
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
    name: 'Przeliczenie przez EUR dla USD -> PLN',
    input: {
      netAmount: '100',
      vatRate: '23',
      foreignCurrency: 'USD',
      homeCurrency: 'PLN',
      selectedRateDate: '2026-03-13',
      ratesByDate: {
        '2026-03-13': { EUR: 1, USD: 1.1, PLN: 4.4 },
      },
    },
    expectVat: 92,
    expectVatAndRateCombined: '92.00_4.0000',
  },
  {
    name: 'Ta sama waluta EUR -> EUR',
    input: {
      netAmount: '100',
      vatRate: '23',
      foreignCurrency: 'EUR',
      homeCurrency: 'EUR',
      selectedRateDate: '2026-03-13',
      ratesByDate: {
        '2026-03-13': { EUR: 1, USD: 1.1, PLN: 4.4 },
      },
    },
    expectVat: 23,
    expectVatAndRateCombined: '23.00_1.0000',
  },
  {
    name: 'Walidacja błędnej kwoty netto',
    input: {
      netAmount: '0',
      vatRate: '23',
      foreignCurrency: 'EUR',
      homeCurrency: 'PLN',
      selectedRateDate: '2026-03-13',
      ratesByDate: {
        '2026-03-13': { EUR: 1, PLN: 4.4 },
      },
    },
    expectError: 'Podaj poprawną kwotę netto większą od zera.',
  },
  {
    name: 'Kurs VAT_Kurs jako liczba jednostek waluty domowej za 1 jednostkę waluty dokumentu',
    input: {
      netAmount: '100',
      vatRate: '10',
      foreignCurrency: 'USD',
      homeCurrency: 'PLN',
      selectedRateDate: '2026-03-13',
      ratesByDate: {
        '2026-03-13': { EUR: 1, USD: 1.2, PLN: 4.8 },
      },
    },
    expectVat: 40,
    expectVatAndRateCombined: '40.00_4.0000',
  },
  {
    name: 'Obsługa przecinka w kwocie netto',
    input: {
      netAmount: '100,50',
      vatRate: '20',
      foreignCurrency: 'EUR',
      homeCurrency: 'PLN',
      selectedRateDate: '2026-03-13',
      ratesByDate: {
        '2026-03-13': { EUR: 1, PLN: 4.0 },
      },
    },
    expectVat: 80.4,
    expectVatAndRateCombined: '80.40_4.0000',
  },
  {
    name: 'VAT_Kurs bez separatorów tysięcy',
    input: {
      netAmount: '12500',
      vatRate: '20',
      foreignCurrency: 'EUR',
      homeCurrency: 'PLN',
      selectedRateDate: '2026-03-13',
      ratesByDate: {
        '2026-03-13': { EUR: 1, PLN: 4.0 },
      },
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

function assertSelfTests() {
  const results = runSelfTests();
  const failed = results.filter((test) => !test.passed);

  if (failed.length > 0) {
    console.error('Niepowodzenie testów kalkulatora VAT:', failed);
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
  const [netAmount, setNetAmount] = useState('1000');
  const [vatRate, setVatRate] = useState('23');
  const [foreignCurrency, setForeignCurrency] = useState('EUR');
  const [homeCurrency, setHomeCurrency] = useState('PLN');
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [ratesByDate, setRatesByDate] = useState<RatesByDate>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceInfo, setSourceInfo] = useState('');

  const fetchRates = async () => {
    if (isFutureDate(selectedDate)) {
      setRatesByDate({});
      setSourceInfo('');
      setError('Wybrana data pochodzi z przyszłości');
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
        throw new Error(`Błąd HTTP ${response.status}`);
      }

      const data = (await response.json()) as { rates?: Record<string, Record<string, number>> };
      if (!data.rates || Object.keys(data.rates).length === 0) {
        throw new Error('Brak danych kursowych dla wskazanego zakresu.');
      }

      const nextRatesByDate: RatesByDate = {};
      Object.entries(data.rates).forEach(([date, dayRates]) => {
        nextRatesByDate[date] = {
          EUR: 1,
          ...dayRates,
        };
      });

      setRatesByDate(nextRatesByDate);
      setSourceInfo('Źródło: Frankfurter API (kursy referencyjne EBC)');
    } catch (fetchError) {
      setRatesByDate({});
      setSourceInfo('');
      setError(fetchError instanceof Error ? fetchError.message : 'Nie udało się pobrać kursów.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    assertSelfTests();
  }, []);

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
  }, [selectedDate]);

  const selectedRateDate = useMemo(
    () => findClosestRateDate(ratesByDate, selectedDate),
    [ratesByDate, selectedDate]
  );

  const futureDateError = useMemo(
    () => (isFutureDate(selectedDate) ? 'Wybrana data pochodzi z przyszłości' : ''),
    [selectedDate]
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
      }),
    [netAmount, vatRate, foreignCurrency, homeCurrency, ratesByDate, selectedRateDate]
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
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <Calculator className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Kalkulator VAT wg kursu EBC</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="net">Kwota netto dokumentu</Label>
                <Input
                  id="net"
                  value={netAmount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNetAmount(e.target.value)}
                  placeholder="Np. 1000.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vat">Stawka VAT (%)</Label>
                <Input
                  id="vat"
                  value={vatRate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setVatRate(e.target.value)}
                  placeholder="Np. 23"
                />
              </div>

              <div className="space-y-2">
                <Label>Waluta dokumentu</Label>
                <Select value={foreignCurrency} onValueChange={setForeignCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz walutę" />
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
                <Label>Waluta domowa</Label>
                <Select value={homeCurrency} onValueChange={setHomeCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz walutę" />
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
                <Label htmlFor="date">Data kursu</Label>
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
                    Odśwież
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Wynik</CardTitle>
              
            </CardHeader>
            <CardContent className="space-y-4">
              {futureDateError ? (
                <Alert className="border-red-200 bg-red-50 text-red-900">
                  <AlertCircle className="h-4 w-4 text-red-700" />
                  <AlertTitle>Błąd danych wejściowych</AlertTitle>
                  <AlertDescription>{futureDateError}</AlertDescription>
                </Alert>
              ) : error ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Błąd pobierania danych</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : calculation.error ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Uzupełnij dane</AlertTitle>
                  <AlertDescription>{calculation.error}</AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert className={rateAlertClassName}>
                    <CheckCircle2 className={rateAlertIconClassName} />
                    <AlertTitle>Zastosowany dzień kursu</AlertTitle>
                    <AlertDescription>
                      {isFallbackRate
                        ? `Dla dnia ${selectedDate} brak publikacji EBC, więc użyto ostatniego dostępnego kursu z dnia ${selectedRateDate}.`
                        : `Użyto kursu z dnia ${selectedRateDate}.`}
                    </AlertDescription>
                  </Alert>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Metric label="Netto w walucie domowej" value={formatNumber(calculation.netInHome, homeCurrency)} />
                    <Metric label="VAT w walucie domowej" value={formatNumber(calculation.vatInHome, homeCurrency)} />
                    <Metric label="Brutto w walucie domowej" value={formatNumber(calculation.grossInHome, homeCurrency)} />
                    <Metric label="VAT_Kurs" value={calculation.vatAndRateCombined ?? '—'} />
                  </div>

                  <div className="rounded-2xl border bg-white p-4 text-sm leading-6">
                    <div>
                      <span className="font-medium">Kurs {foreignCurrency}/EUR:</span> {formatRate(calculation.foreignRate, 4)}
                    </div>
                    <div>
                      <span className="font-medium">Kurs {homeCurrency}/EUR:</span> {formatRate(calculation.homeRate, 4)}
                    </div>
                    <div>
                      <span className="font-medium">Źródło:</span> {sourceInfo}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Uwagi</CardTitle>
            <CardDescription>Założenia zastosowane w aplikacji</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
            <p>• Aplikacja korzysta z kursów referencyjnych EBC udostępnianych przez Frankfurter API.</p>
            <p>• Kursy EBC są notowane względem EUR, więc każde przeliczenie przebiega przez EUR.</p>
            <p>• Gdy dla wybranego dnia nie ma publikacji, używany jest ostatni wcześniejszy dostępny kurs.</p>
            <p>• Zakres pobrania obejmuje ostatnie maks. 120 dni do wybranej daty.</p>
            <p>• Automatyczne odświeżanie działa codziennie o 16:30 CET dla bieżącej daty, gdy strona jest otwarta.</p>
            <p>• Wzór: netto w EUR = netto w walucie dokumentu ÷ kurs waluty dokumentu; netto w walucie domowej = netto w EUR × kurs waluty domowej; VAT = netto w walucie domowej × stawka VAT; kurs w polu VAT_Kurs = liczba jednostek waluty domowej za 1 jednostkę waluty dokumentu.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
