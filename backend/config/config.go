package config

type Config struct {
	DB    DBConfig
	Admin AdminConfig
	HTTP  HTTPConfig
}

type DBConfig struct {
	URL            string
	MigrationsPath string
}

type AdminConfig struct {
	Username     string
	Password     string
	AuthSecret   string
	CookieName   string
	CookieSecure bool
	TokenTTLMin  int
}

type HTTPConfig struct {
	ListenAddr     string
	FrontendOrigin string
}
