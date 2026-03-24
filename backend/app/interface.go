package app

type LandingApplication interface {
	Run() error
	Shutdown() error
}
